"""ロギング設定"""
import logging
import sys
import structlog


def configure_logging(log_level: str = "INFO") -> None:
    """
    構造化ログ設定を行う

    Args:
        log_level: ログレベル (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """

    # 標準ライブラリのロギング設定
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # structlogの設定
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """
    構造化ロガーを取得

    Args:
        name: ロガー名

    Returns:
        structlog.BoundLogger: 構造化ロガー
    """
    return structlog.get_logger(name)
