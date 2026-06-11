from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.database import Base


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    github_token: Mapped[str] = mapped_column(String(255), default="")
    github_repo: Mapped[str] = mapped_column(String(255), default="")
    target_path: Mapped[str] = mapped_column(String(255), default="")
    can_read_repo: Mapped[bool] = mapped_column(Boolean, default=True)
    can_open_pr: Mapped[bool] = mapped_column(Boolean, default=True)
    can_auto_merge: Mapped[bool] = mapped_column(Boolean, default=False)
    require_human_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    max_files_per_pr: Mapped[int] = mapped_column(default=5)
    allowed_file_extensions: Mapped[str] = mapped_column(Text, default=".py,.js,.ts,.json")
    anthropic_api_key: Mapped[str] = mapped_column(Text, default="")
    claude_model: Mapped[str] = mapped_column(String(100), default="claude-sonnet-4-6")
