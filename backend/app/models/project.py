"""Projectモデル"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Project(Base):
    """プロジェクトモデル"""

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    default_model: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="claude-sonnet-4-20250514",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # リレーション
    sessions: Mapped[list["Session"]] = relationship(
        "Session",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    prompt_history: Mapped[list["PromptHistory"]] = relationship(
        "PromptHistory",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name})>"
