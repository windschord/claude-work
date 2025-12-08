"""ロギング設定のテスト"""
import json
import pytest
from io import StringIO
import sys

from app.logging_config import configure_logging, get_logger


def test_logging_outputs_json_format():
    """ロギングがJSON形式で出力されることを確認"""
    # StringIOを使ってログ出力をキャプチャ
    log_output = StringIO()

    # 一時的にstdoutを置き換え
    original_stdout = sys.stdout
    sys.stdout = log_output

    try:
        configure_logging("INFO")
        logger = get_logger("test_logger")
        logger.info("test_message", test_key="test_value")

        # 出力を取得
        output = log_output.getvalue()

        # JSON形式であることを確認
        log_lines = [line for line in output.strip().split('\n') if line]
        assert len(log_lines) > 0

        # 最後のログ行をパース
        last_log = json.loads(log_lines[-1])
        assert last_log["event"] == "test_message"
        assert last_log["test_key"] == "test_value"
        assert "timestamp" in last_log
        assert last_log["level"] == "info"

    finally:
        # stdoutを元に戻す
        sys.stdout = original_stdout


def test_get_logger_returns_structlog_logger():
    """get_loggerがstructlogロガーを返すことを確認"""
    configure_logging("INFO")
    logger = get_logger("test")

    # structlogのBoundLoggerであることを確認
    assert hasattr(logger, "bind")
    assert hasattr(logger, "info")
    assert hasattr(logger, "error")
    assert hasattr(logger, "warning")
