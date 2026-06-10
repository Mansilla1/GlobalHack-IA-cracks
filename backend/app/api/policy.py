from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.policy import Policy

router = APIRouter(prefix="/policy", tags=["policy"])


class PolicyUpdate(BaseModel):
    github_token: str = ""
    github_repo: str = ""
    can_read_repo: bool = True
    can_open_pr: bool = True
    can_auto_merge: bool = False
    require_human_approval: bool = True
    max_files_per_pr: int = 5
    allowed_file_extensions: str = ".py,.js,.ts,.json"


class PolicyResponse(PolicyUpdate):
    id: int
    # Mask the token for display
    github_token_set: bool = False

    model_config = {"from_attributes": True}


@router.get("/", response_model=PolicyResponse)
async def get_policy(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy))
    policy = result.scalar_one_or_none()
    if not policy:
        policy = Policy()
        db.add(policy)
        await db.commit()
        await db.refresh(policy)
    resp = PolicyResponse.model_validate(policy)
    resp.github_token_set = bool(policy.github_token)
    resp.github_token = ""  # never return raw token
    return resp


@router.put("/", response_model=PolicyResponse)
async def update_policy(payload: PolicyUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy))
    policy = result.scalar_one_or_none()
    if not policy:
        policy = Policy()
        db.add(policy)

    for field, value in payload.model_dump().items():
        if field == "github_token" and not value:
            continue  # don't overwrite token with empty string
        setattr(policy, field, value)

    await db.commit()
    await db.refresh(policy)
    resp = PolicyResponse.model_validate(policy)
    resp.github_token_set = bool(policy.github_token)
    resp.github_token = ""
    return resp
