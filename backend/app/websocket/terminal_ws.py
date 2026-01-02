"""ターミナル用WebSocketエンドポイント"""
import asyncio
import json
from typing import Dict, Optional

from fastapi import Cookie, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.logging_config import get_logger
from app.models.auth_session import AuthSession
from app.services.pty_manager import PTYManager
from app.websocket.connection_manager import ConnectionManager

logger = get_logger(__name__)

# グローバルな接続管理インスタンス
connection_manager = ConnectionManager()

# セッションIDごとのPTYManager
_pty_managers: Dict[str, PTYManager] = {}


async def verify_websocket_session(
    websocket: WebSocket,
    db: AsyncSession,
    session_id: Optional[str] = None,
    query_session_id: Optional[str] = None,
) -> AuthSession:
    """
    WebSocket用のセッション検証

    Args:
        websocket: WebSocket接続
        session_id: クッキーから取得したセッションID
        query_session_id: クエリパラメータから取得したセッションID
        db: データベースセッション

    Returns:
        有効な認証セッション

    Raises:
        WebSocketDisconnect: セッションが無効な場合
    """
    # クエリパラメータを優先
    auth_session_id = query_session_id or session_id

    if not auth_session_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)

    try:
        # verify_sessionと同じロジックで検証
        from datetime import datetime, timezone

        import bcrypt
        from sqlalchemy import select

        stmt = select(AuthSession).where(AuthSession.expires_at > datetime.now(timezone.utc))
        result = await db.execute(stmt)
        sessions = result.scalars().all()

        for session in sessions:
            try:
                if bcrypt.checkpw(auth_session_id.encode(), session.token_hash.encode()):
                    return session
            except Exception:
                continue

        # 有効なセッションが見つからない場合
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)

    except WebSocketDisconnect:
        raise
    except Exception as e:
        logger.error("websocket_session_verification_error", error=str(e))
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        raise WebSocketDisconnect(code=status.WS_1011_INTERNAL_ERROR)


async def terminal_websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession,
    auth_session_id: Optional[str] = None,
    query_session_id: Optional[str] = None,
):
    """
    ターミナル用WebSocketエンドポイント

    Args:
        websocket: WebSocket接続
        session_id: セッションID（パスパラメータ）
        db: データベースセッション
        auth_session_id: 認証セッションID（クッキーから）
        query_session_id: 認証セッションID（クエリパラメータから）
    """
    # 認証検証
    auth_session = await verify_websocket_session(
        websocket=websocket,
        db=db,
        session_id=auth_session_id,
        query_session_id=query_session_id,
    )

    # セッション情報を取得
    from sqlalchemy import select

    from app.models.session import Session

    stmt = select(Session).where(Session.id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        logger.warning("session_not_found", session_id=session_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # WebSocket接続を受け入れる
    await websocket.accept()
    connection_manager.connect(websocket, session_id)

    logger.info(
        "terminal_websocket_connected",
        session_id=session_id,
        auth_session_id=str(auth_session.id),
    )

    # PTYManagerを作成または取得
    if session_id not in _pty_managers:
        # worktree_pathを取得
        from app.models.project import Project

        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            logger.error("project_not_found", project_id=session.project_id)
            await websocket.send_json(
                {"type": "error", "message": "Project not found"}
            )
            await websocket.close()
            return

        # worktree_pathを構築
        worktree_path = f"{project.path}/.worktrees/{session.name}"

        # PTYManagerを作成
        pty_manager = PTYManager(worktree_path)
        _pty_managers[session_id] = pty_manager

        # PTYプロセスを起動
        try:
            await pty_manager.start()
            logger.info("pty_started", session_id=session_id)
        except Exception as e:
            logger.error("pty_start_error", session_id=session_id, error=str(e))
            await websocket.send_json(
                {"type": "error", "message": f"Failed to start PTY: {str(e)}"}
            )
            del _pty_managers[session_id]
            await websocket.close()
            return
    else:
        pty_manager = _pty_managers[session_id]

    # 出力読み取りタスクを作成
    output_task = asyncio.create_task(_read_pty_output(websocket, session_id, pty_manager))

    try:
        # クライアントからのメッセージを処理
        while True:
            try:
                # メッセージを受信（タイムアウト付き）
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                message = json.loads(data)

                message_type = message.get("type")

                if message_type == "input":
                    # 入力をPTYに送信
                    input_data = message.get("data", "")
                    if pty_manager.is_alive():
                        await pty_manager.write(input_data)
                        logger.debug(
                            "terminal_input_sent",
                            session_id=session_id,
                            data_length=len(input_data),
                        )
                    else:
                        logger.warning("pty_not_alive_on_input", session_id=session_id)
                        await websocket.send_json(
                            {"type": "error", "message": "PTY process is not running"}
                        )

                elif message_type == "resize":
                    # ターミナルサイズを変更
                    rows = message.get("rows", 24)
                    cols = message.get("cols", 80)
                    if pty_manager.is_alive():
                        await pty_manager.resize(rows, cols)
                        logger.debug(
                            "terminal_resized",
                            session_id=session_id,
                            rows=rows,
                            cols=cols,
                        )
                    else:
                        logger.warning("pty_not_alive_on_resize", session_id=session_id)

                else:
                    logger.warning(
                        "unknown_terminal_message_type",
                        session_id=session_id,
                        message_type=message_type,
                    )

            except asyncio.TimeoutError:
                # タイムアウトは正常、出力チェックに戻る
                continue
            except json.JSONDecodeError as e:
                logger.error("terminal_message_json_error", session_id=session_id, error=str(e))
                continue
            except WebSocketDisconnect:
                logger.info("terminal_websocket_disconnected", session_id=session_id)
                break
            except Exception as e:
                logger.error("terminal_message_handling_error", session_id=session_id, error=str(e))
                break

    except Exception as e:
        logger.error("terminal_websocket_error", session_id=session_id, error=str(e))

    finally:
        # クリーンアップ
        output_task.cancel()
        try:
            await output_task
        except asyncio.CancelledError:
            pass

        connection_manager.disconnect(websocket, session_id)

        # PTYプロセスを停止（他の接続がない場合）
        if session_id in _pty_managers and not connection_manager.active_connections.get(
            session_id
        ):
            pty_manager = _pty_managers[session_id]
            await pty_manager.stop()
            del _pty_managers[session_id]
            logger.info("pty_stopped_and_removed", session_id=session_id)

        logger.info("terminal_websocket_connection_closed", session_id=session_id)


async def _read_pty_output(websocket: WebSocket, session_id: str, pty_manager: PTYManager):
    """
    PTYからの出力を読み取ってWebSocketに送信する

    Args:
        websocket: WebSocket接続
        session_id: セッションID
        pty_manager: PTYManager
    """
    try:
        while pty_manager.is_alive():
            # PTYから出力を読み取る
            output = await pty_manager.read(size=4096, timeout=0.1)

            if output:
                # 出力をクライアントに送信
                await websocket.send_json({"type": "output", "data": output})
                logger.debug(
                    "terminal_output_sent",
                    session_id=session_id,
                    data_length=len(output),
                )

            # 短い待機
            await asyncio.sleep(0.01)

        # プロセスが終了したことを通知
        logger.info("pty_process_exited", session_id=session_id)
        await websocket.send_json({"type": "exit", "code": 0})

    except WebSocketDisconnect:
        logger.info("terminal_output_reader_disconnected", session_id=session_id)
    except asyncio.CancelledError:
        logger.info("terminal_output_reader_cancelled", session_id=session_id)
    except Exception as e:
        logger.error("terminal_output_reader_error", session_id=session_id, error=str(e))
