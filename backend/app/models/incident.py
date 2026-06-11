from datetime import datetime
from enum import Enum
from sqlalchemy import Integer, String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.database import Base


class IncidentType(str, Enum):
    quick_fix = "quick_fix"
    edge_case = "edge_case"
    architectural = "architectural"
    unknown = "unknown"


class IncidentStatus(str, Enum):
    detected = "detected"
    analyzing = "analyzing"
    fixing = "fixing"
    pr_opened = "pr_opened"
    report_generated = "report_generated"
    resolved = "resolved"
    failed = "failed"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255))
    error_message: Mapped[str] = mapped_column(Text)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="manual")  # sentry, manual, webhook
    incident_type: Mapped[str] = mapped_column(String(50), default=IncidentType.unknown)
    status: Mapped[str] = mapped_column(String(50), default=IncidentStatus.detected)
    github_pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    postmortem: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
