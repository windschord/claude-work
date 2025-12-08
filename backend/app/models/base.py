"""SQLAlchemyベースモデル"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """すべてのモデルの基底クラス"""

    pass
