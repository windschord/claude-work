"""セッション用WebSocketエンドポイント"""
import json
import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import Cookie, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.services.process_manager import ProcessManager
from app.websocket.connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

# グローバルな接続管理インスタンス
connection_manager = ConnectionManager()

# セッションIDごとのProcessManager
_process_managers: Dict[str, ProcessManager] = {}


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

        stmt = select(AuthSession).where(
            AuthSession.expires_at > datetime.now(timezone.utc)
        )
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
        logger.error(f"Error verifying WebSocket session: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        raise WebSocketDisconnect(code=status.WS_1011_INTERNAL_ERROR)


async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession,
    auth_session_id: Optional[str] = None,
    query_session_id: Optional[str] = None,
):
    """
    WebSocketエンドポイント

    Args:
        websocket: WebSocket接続
        session_id: セッションID（パスパラメータ）
        db: データベースセッション
        auth_session_id: 認証セッションID（クッキーから）
        query_session_id: クエリパラメータのセッションID
    """
    # 認証確認
    auth_session = await verify_websocket_session(
        websocket=websocket,
        db=db,
        session_id=auth_session_id,
        query_session_id=query_session_id,
    )

    # WebSocket接続を受け入れ
    await websocket.accept()

    # 接続を管理
    connection_manager.connect(websocket, session_id)

    try:
        # 接続成功メッセージを送信
        await connection_manager.send_message(
            session_id,
            websocket,
            {"type": "session_status", "status": "connected"},
        )

        # ProcessManagerのコールバックを設定
        def on_output(data: Dict[str, Any]) -> None:
            """ProcessManagerからの出力コールバック"""
            import asyncio

            asyncio.create_task(
                connection_manager.broadcast_to_session(
                    session_id, {"type": "assistant_output", "content": data}
                )
            )

        def on_permission_request(data: Dict[str, Any]) -> None:
            """権限確認リクエストのコールバック"""
            import asyncio

            asyncio.create_task(
                connection_manager.broadcast_to_session(
                    session_id,
                    {
                        "type": "permission_request",
                        "permission_id": data.get("permission_id"),
                        "description": data.get("description"),
                    },
                )
            )

        def on_process_exit(exit_code: int) -> None:
            """プロセス終了のコールバック"""
            import asyncio

            status_msg = "completed" if exit_code == 0 else "error"
            asyncio.create_task(
                connection_manager.broadcast_to_session(
                    session_id, {"type": "session_status", "status": status_msg}
                )
            )

        # ProcessManagerを作成（まだ存在しない場合）
        if session_id not in _process_managers:
            process_manager = ProcessManager(
                on_output=on_output,
                on_permission_request=on_permission_request,
                on_process_exit=on_process_exit,
            )
            _process_managers[session_id] = process_manager

        # メッセージ受信ループ
        while True:
            try:
                # メッセージを受信
                data = await websocket.receive_text()

                # JSONパース
                try:
                    message = json.loads(data)
                except json.JSONDecodeError:
                    await connection_manager.send_message(
                        session_id,
                        websocket,
                        {"type": "error", "message": "Invalid JSON format"},
                    )
                    continue

                # メッセージタイプに応じて処理
                message_type = message.get("type")

                if message_type == "user_input":
                    # ユーザー入力をProcessManagerに転送
                    content = message.get("content", "")
                    process_manager = _process_managers.get(session_id)

                    if process_manager and process_manager.is_running:
                        await process_manager.send_input(content)
                    else:
                        await connection_manager.send_message(
                            session_id,
                            websocket,
                            {
                                "type": "error",
                                "message": "Process is not running",
                            },
                        )

                elif message_type == "permission_response":
                    # 権限応答をProcessManagerに転送
                    permission_id = message.get("permission_id")
                    approved = message.get("approved", False)

                    process_manager = _process_managers.get(session_id)

                    if process_manager and process_manager.is_running:
                        # 権限応答を送信（"yes"または"no"）
                        response = "yes" if approved else "no"
                        await process_manager.send_input(response)
                    else:
                        await connection_manager.send_message(
                            session_id,
                            websocket,
                            {
                                "type": "error",
                                "message": "Process is not running",
                            },
                        )

                else:
                    await connection_manager.send_message(
                        session_id,
                        websocket,
                        {
                            "type": "error",
                            "message": f"Unknown message type: {message_type}",
                        },
                    )

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for session {session_id}")
                break
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await connection_manager.send_message(
                    session_id,
                    websocket,
                    {"type": "error", "message": str(e)},
                )

    finally:
        # 接続をクリーンアップ
        connection_manager.disconnect(websocket, session_id)
        logger.info(f"WebSocket connection cleaned up for session {session_id}")
