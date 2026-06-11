from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import incidents, policy, projects, webhook, agent_ws
from app.models.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Autonomic Sentinel API",
    description="AI-Driven Autonomous Healing Agent",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router, prefix="/api")
app.include_router(policy.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(webhook.router, prefix="/api")
app.include_router(agent_ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Autonomic Sentinel"}
