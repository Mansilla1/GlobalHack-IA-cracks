from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.incident import Incident

router = APIRouter(prefix="/webhook", tags=["webhook"])


@router.post("/sentry")
async def sentry_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive Sentry webhook and create an incident."""
    body = await request.json()

    # Sentry webhook payload structure
    event = body.get("event", {})
    title = event.get("title", body.get("message", "Unknown error from Sentry"))
    error_message = event.get("message", title)
    stack_trace = None

    exception = event.get("exception", {})
    values = exception.get("values", [])
    if values:
        frames = values[0].get("stacktrace", {}).get("frames", [])
        stack_trace = "\n".join(
            f"  File \"{f.get('filename')}\", line {f.get('lineno')}, in {f.get('function')}"
            for f in frames[-5:]
        )

    incident = Incident(
        title=title,
        error_message=error_message,
        stack_trace=stack_trace,
        source="sentry",
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return {"incident_id": incident.id, "status": "created"}


@router.post("/simulate")
async def simulate_error(request: Request, db: AsyncSession = Depends(get_db)):
    """Simulate an error for demo purposes."""
    body = await request.json()
    incident = Incident(
        title=body.get("title", "Simulated error"),
        error_message=body.get("error_message", "An error occurred"),
        stack_trace=body.get("stack_trace"),
        source="simulation",
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return {"incident_id": incident.id, "status": "created"}
