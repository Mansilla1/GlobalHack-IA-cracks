from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.project import Project

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    github_repo: str = ""
    github_token: str = ""
    target_path: str = ""
    can_open_pr: bool = True


class ProjectUpdate(BaseModel):
    name: str | None = None
    github_repo: str | None = None
    github_token: str | None = None
    target_path: str | None = None
    can_open_pr: bool | None = None
    active: bool | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    github_repo: str
    github_token: str = ""
    github_token_set: bool
    target_path: str
    can_open_pr: bool
    active: bool
    created_at: str

    model_config = {"from_attributes": True}


def _normalize_repo(repo: str) -> str:
    """Accept full GitHub URLs and strip them down to owner/repo."""
    repo = repo.strip().rstrip("/")
    for prefix in ("https://github.com/", "http://github.com/", "github.com/"):
        if repo.startswith(prefix):
            repo = repo[len(prefix):]
    return repo


def _to_response(p: Project) -> ProjectResponse:
    return ProjectResponse(
        id=p.id,
        name=p.name,
        github_repo=p.github_repo,
        github_token="",
        github_token_set=bool(p.github_token),
        target_path=p.target_path,
        can_open_pr=p.can_open_pr,
        active=p.active,
        created_at=str(p.created_at),
    )


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at))
    return [_to_response(p) for p in result.scalars().all()]


@router.post("/", response_model=ProjectResponse, status_code=201)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["github_repo"] = _normalize_repo(data.get("github_repo", ""))
    project = Project(**data)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _to_response(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: int, payload: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "github_token" and not value:
            continue
        if field == "github_repo":
            value = _normalize_repo(value)
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return _to_response(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/validate")
async def validate_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.github_token:
        raise HTTPException(status_code=400, detail="No GitHub token configured for this project")
    if not project.github_repo:
        raise HTTPException(status_code=400, detail="No GitHub repository configured for this project")
    try:
        from github import Github
        g = Github(project.github_token)
        repo = g.get_repo(project.github_repo)
        return {
            "valid": True,
            "repo": repo.full_name,
            "default_branch": repo.default_branch,
            "private": repo.private,
        }
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
