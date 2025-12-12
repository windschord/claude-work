"""PromptHistoryモデル"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PromptHistory(Base):
    """プロンプト履歴モデル"""

    __tablename__ = "prompt_history"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # リレーション
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="prompt_history",
    )

    def __repr__(self) -> str:
        return f"<PromptHistory(id={self.id}, project_id={self.project_id})>"
