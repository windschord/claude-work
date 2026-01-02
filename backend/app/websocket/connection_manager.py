"""WebSocket接続管理クラス"""
import logging
from typing import Any, Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket接続を管理するクラス"""

    def __init__(self):
        """ConnectionManagerの初期化"""
        # セッションIDごとの接続リストを管理
        # {session_id: [websocket1, websocket2, ...]}
        self.active_connections: Dict[str, List[WebSocket]] = {}

    def connect(self, websocket: WebSocket, session_id: str) -> None:
        """
        WebSocket接続を追加

        Args:
            websocket: WebSocket接続
            session_id: セッションID
        """
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []

        self.active_connections[session_id].append(websocket)
        logger.info(f"WebSocket connected for session {session_id}")

    def disconnect(self, websocket: WebSocket, session_id: str) -> None:
        """
        WebSocket接続を削除

        Args:
            websocket: WebSocket接続
            session_id: セッションID
        """
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                logger.info(f"WebSocket disconnected for session {session_id}")

            # セッションに接続がなくなった場合は削除
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                logger.info(f"No more connections for session {session_id}")

    async def send_message(
        self, session_id: str, websocket: WebSocket, message: Dict[str, Any]
    ) -> None:
        """
        特定のWebSocket接続にメッセージを送信

        Args:
            session_id: セッションID
            websocket: WebSocket接続
            message: 送信するメッセージ
        """
        try:
            await websocket.send_json(message)
            logger.debug(f"Message sent to session {session_id}: {message.get('type')}")
        except Exception as e:
            logger.error(f"Error sending message to session {session_id}: {e}")
            # エラーが発生した場合は接続を削除
            self.disconnect(websocket, session_id)

    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any]) -> None:
        """
        セッションの全接続にメッセージをブロードキャスト

        Args:
            session_id: セッションID
            message: 送信するメッセージ
        """
        if session_id not in self.active_connections:
            logger.warning(f"No active connections for session {session_id}")
            return

        # 削除する接続のリスト
        disconnected_websockets = []

        for websocket in self.active_connections[session_id]:
            try:
                await websocket.send_json(message)
                logger.debug(
                    f"Message broadcast to session {session_id}: {message.get('type')}"
                )
            except Exception as e:
                logger.error(f"Error broadcasting to session {session_id}: {e}")
                disconnected_websockets.append(websocket)

        # エラーが発生した接続を削除
        for websocket in disconnected_websockets:
            self.disconnect(websocket, session_id)
