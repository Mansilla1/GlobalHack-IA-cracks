from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.agent.scanner import scan_repository
from app.models.database import AsyncSessionLocal
from app.models.incident import Incident
from app.models.policy import Policy
from app.models.project import Project

router = APIRouter(tags=["scan"])


@router.websocket("/ws/scan/{project_id}")
async def scan_websocket(websocket: WebSocket, project_id: int):
    await websocket.accept()

    async with AsyncSessionLocal() as db:
        proj_result = await db.execute(select(Project).where(Project.id == project_id))
        project = proj_result.scalar_one_or_none()
        if not project:
            await websocket.send_json({"type": "error", "message": "Project not found"})
            await websocket.close()
            return

        policy_result = await db.execute(select(Policy))
        policy = policy_result.scalar_one_or_none()

        if policy and not policy.agent_enabled:
            await websocket.send_json({"type": "error", "message": "Agent is disabled."})
            await websocket.close()
            return

    api_key = policy.anthropic_api_key if policy else ""
    model = (policy.claude_model or "claude-sonnet-4-6") if policy else "claude-sonnet-4-6"

    incident_ids: list[int] = []

    try:
        async for event in scan_repository(
            github_token=project.github_token,
            github_repo=project.github_repo,
            target_path=project.target_path,
            api_key=api_key,
            model=model,
        ):
            await websocket.send_json(event)

            if event["type"] == "done":
                bugs = event.get("bugs", [])
                async with AsyncSessionLocal() as db:
                    for bug in bugs:
                        incident = Incident(
                            title=bug["title"],
                            error_message=bug["error_message"],
                            stack_trace=bug.get("stack_trace", ""),
                            incident_type=bug.get("incident_type", "unknown"),
                            source="scan",
                            project_id=project.id,
                            project_name=project.name,
                        )
                        db.add(incident)
                        await db.flush()
                        incident_ids.append(incident.id)
                    await db.commit()

                await websocket.send_json({
                    "type": "incidents_created",
                    "incident_ids": incident_ids,
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
