# Autonomic Sentinel

AI-Driven Autonomous Healing Agent — AI/Works Innovation Hackathon 2026

**Team:** Daniel Mansilla, Gisela Yumi | **Mentor:** Andrea Santacruz

## Quick Start

### 1. First time setup

```bash
make setup        # creates backend/.env + installs all dependencies
# Edit backend/.env and add your ANTHROPIC_API_KEY
make up           # starts backend + frontend
```

### 2. Daily use

```bash
make up           # start everything
make logs         # tail logs from both services
make down         # stop everything
make see          # open browser tabs
```

### 3. Demo target (optional — the intentionally buggy service)

```bash
cd demo-target
pip install fastapi uvicorn
uvicorn app:app --port 8001 --reload
```

## Demo Flow

1. Open http://localhost:5173
2. Go to **Governance** → set your GitHub token + repo (`owner/repo`)
3. Go to **Dashboard** → click one of the red scenario buttons
4. Watch the agent analyze and fix the incident live
5. A real GitHub PR appears with the fix

## Architecture

```
Frontend (React + Vite) ── WebSocket ──> Backend (FastAPI)
                                              |
                                        Claude Agent
                                        (tool use)
                                         ├── read_file
                                         ├── list_files
                                         ├── search_code
                                         ├── classify_incident
                                         └── create_pull_request
                                              |
                                         GitHub API
```

## Governance Layer

The agent only performs actions you explicitly authorize:

| Permission | Default |
|---|---|
| Read repository | on |
| Open Pull Requests | on |
| Auto-merge | off |
| Require human approval | on |
