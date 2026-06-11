from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    from app.models import project as _  # noqa: ensure Project is registered before create_all
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in [
            "ALTER TABLE policies ADD COLUMN target_path VARCHAR DEFAULT ''",
            "ALTER TABLE policies ADD COLUMN anthropic_api_key TEXT DEFAULT ''",
            "ALTER TABLE policies ADD COLUMN claude_model VARCHAR(100) DEFAULT 'claude-sonnet-4-6'",
            "ALTER TABLE incidents ADD COLUMN project_id INTEGER",
            "ALTER TABLE incidents ADD COLUMN project_name VARCHAR(255)",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
