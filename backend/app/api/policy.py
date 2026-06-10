from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.policy import Policy

router = APIRouter(prefix="/policy", tags=["policy"])


class PolicyUpdate(BaseModel):
    github_token: str = ""
    github_repo: str = ""
    target_path: str = ""
    can_read_repo: bool = True
    can_open_pr: bool = True
    can_auto_merge: bool = False
    require_human_approval: bool = True
    max_files_per_pr: int = 5
    allowed_file_extensions: str = ".py,.js,.ts,.json"


class PolicyResponse(PolicyUpdate):
    id: int
    github_token_set: bool = False

    model_config = {"from_attributes": True}


async def _get_or_create_policy(db: AsyncSession) -> Policy:
    result = await db.execute(select(Policy))
    policy = result.scalar_one_or_none()
    if not policy:
        policy = Policy()
        db.add(policy)
        await db.commit()
        await db.refresh(policy)
    return policy


def _to_response(policy: Policy) -> PolicyResponse:
    resp = PolicyResponse.model_validate(policy)
    resp.github_token_set = bool(policy.github_token)
    resp.github_token = ""
    return resp


@router.get("/", response_model=PolicyResponse)
async def get_policy(db: AsyncSession = Depends(get_db)):
    return _to_response(await _get_or_create_policy(db))


@router.put("/", response_model=PolicyResponse)
async def update_policy(payload: PolicyUpdate, db: AsyncSession = Depends(get_db)):
    policy = await _get_or_create_policy(db)
    for field, value in payload.model_dump().items():
        if field == "github_token" and not value:
            continue
        setattr(policy, field, value)
    await db.commit()
    await db.refresh(policy)
    return _to_response(policy)


@router.post("/validate-github")
async def validate_github(db: AsyncSession = Depends(get_db)):
    """Test whether the stored GitHub token can access the configured repo."""
    policy = await _get_or_create_policy(db)
    if not policy.github_token:
        raise HTTPException(status_code=400, detail="No GitHub token configured")
    if not policy.github_repo:
        raise HTTPException(status_code=400, detail="No GitHub repository configured")

    try:
        from github import Github, GithubException
        g = Github(policy.github_token)
        repo = g.get_repo(policy.github_repo)
        return {
            "valid": True,
            "repo": repo.full_name,
            "default_branch": repo.default_branch,
            "private": repo.private,
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
