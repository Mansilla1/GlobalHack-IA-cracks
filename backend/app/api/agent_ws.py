import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.agent.sentinel import run_agent_stream
from app.models.database import AsyncSessionLocal
from app.models.incident import Incident, IncidentStatus
from app.models.policy import Policy

router = APIRouter(tags=["agent"])


@router.websocket("/ws/agent/{incident_id}")
async def agent_websocket(websocket: WebSocket, incident_id: int):
    await websocket.accept()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Incident).where(Incident.id == incident_id))
        incident = result.scalar_one_or_none()

        policy_result = await db.execute(select(Policy))
        policy = policy_result.scalar_one_or_none()

        if not incident:
            await websocket.send_json({"type": "error", "message": "Incident not found"})
            await websocket.close()
            return

        incident.status = IncidentStatus.analyzing
        await db.commit()

    github_token = policy.github_token if policy else ""
    github_repo = policy.github_repo if policy else ""
    can_open_pr = policy.can_open_pr if policy else False

    # If policy disallows PRs, override token
    if not can_open_pr:
        github_token = ""

    full_analysis = []
    classification = None
    pr_url = None
    report = None

    try:
        async for event in run_agent_stream(
            incident_title=incident.title,
            error_message=incident.error_message,
            stack_trace=incident.stack_trace or "",
            github_token=github_token,
            github_repo=github_repo,
        ):
            await websocket.send_json(event)

            if event["type"] == "text_delta":
                full_analysis.append(event["text"])
            elif event["type"] == "classification":
                classification = event["value"]
            elif event["type"] == "pr_created":
                pr_url = event["url"]
            elif event["type"] == "done":
                classification = event.get("classification") or classification
                pr_url = event.get("pr_url") or pr_url
                report = event.get("report")

        # Persist results
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Incident).where(Incident.id == incident_id))
            incident = result.scalar_one_or_none()
            if incident:
                incident.agent_analysis = "".join(full_analysis)
                incident.incident_type = classification or "unknown"
                if pr_url:
                    incident.github_pr_url = pr_url
                    incident.status = IncidentStatus.pr_opened
                elif report:
                    incident.postmortem = report
                    incident.status = IncidentStatus.report_generated
                else:
                    incident.status = IncidentStatus.resolved
                await db.commit()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
