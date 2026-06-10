.PHONY: help up down backend frontend install setup ensure-env see logs logs-backend logs-frontend clean

.DEFAULT_GOAL := help

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
PIDS_DIR     := .pids
LOGS_DIR     := .logs

help:
	@echo ""
	@echo "  Autonomic Sentinel — AI Healing Agent"
	@echo ""
	@echo "  Services"
	@echo "  ─────────────────────────────────────────────"
	@echo "  up               Start backend + frontend"
	@echo "  down             Stop all services"
	@echo "  backend          Start backend only  (http://localhost:8000)"
	@echo "  frontend         Start frontend only (http://localhost:5173)"
	@echo ""
	@echo "  Setup"
	@echo "  ─────────────────────────────────────────────"
	@echo "  setup            First time: create .env + install dependencies"
	@echo "  install          Install dependencies (backend + frontend)"
	@echo ""
	@echo "  Dev tools"
	@echo "  ─────────────────────────────────────────────"
	@echo "  see              Open backend docs + frontend in browser"
	@echo "  logs             Tail logs from both services (Ctrl+C to exit)"
	@echo "  logs-backend     Tail backend logs"
	@echo "  logs-frontend    Tail frontend logs"
	@echo "  clean            Remove PIDs, logs and database"
	@echo ""

# -- Env files ---------------------------------------------------------------
ensure-env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		echo "-> Creating $(BACKEND_DIR)/.env from .env.example"; \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "   WARNING: Edit $(BACKEND_DIR)/.env and add your ANTHROPIC_API_KEY"; \
	fi

# -- Setup -------------------------------------------------------------------
setup: ensure-env install
	@echo ""
	@echo "Setup complete. Edit backend/.env then run 'make up'."

install:
	@echo "-> Installing backend dependencies..."
	@cd $(BACKEND_DIR) && python -m venv .venv && \
		.venv/bin/pip install -q fastapi "uvicorn[standard]" anthropic pygithub \
			sqlalchemy aiosqlite greenlet pydantic pydantic-settings httpx python-multipart
	@echo "-> Installing frontend dependencies..."
	@cd $(FRONTEND_DIR) && npm install --silent
	@echo "Dependencies installed."

# -- Services ----------------------------------------------------------------
up: ensure-env
	@mkdir -p $(PIDS_DIR) $(LOGS_DIR)
	@$(MAKE) -s _start-backend
	@$(MAKE) -s _start-frontend
	@echo ""
	@echo "Services running:"
	@echo "  Backend  -> http://localhost:8000/api/health"
	@echo "  API Docs -> http://localhost:8000/docs"
	@echo "  Frontend -> http://localhost:5173"
	@echo ""
	@echo "  Run 'make logs' to tail logs or 'make down' to stop."

_start-backend:
	@mkdir -p $(PIDS_DIR) $(LOGS_DIR)
	@if [ -f $(PIDS_DIR)/backend.pid ] && kill -0 $$(cat $(PIDS_DIR)/backend.pid) 2>/dev/null; then \
		echo "-> Backend already running (PID $$(cat $(PIDS_DIR)/backend.pid))"; \
	else \
		echo "-> Starting backend..."; \
		( cd $(BACKEND_DIR) && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload --port 8000 \
			>> ../$(LOGS_DIR)/backend.log 2>&1 ) & \
		echo $$! > $(PIDS_DIR)/backend.pid; \
		sleep 2; \
		echo "   Backend PID: $$(cat $(PIDS_DIR)/backend.pid)"; \
	fi

_start-frontend:
	@mkdir -p $(PIDS_DIR) $(LOGS_DIR)
	@if [ -f $(PIDS_DIR)/frontend.pid ] && kill -0 $$(cat $(PIDS_DIR)/frontend.pid) 2>/dev/null; then \
		echo "-> Frontend already running (PID $$(cat $(PIDS_DIR)/frontend.pid))"; \
	else \
		echo "-> Starting frontend..."; \
		( cd $(FRONTEND_DIR) && npm run dev >> ../$(LOGS_DIR)/frontend.log 2>&1 ) & \
		echo $$! > $(PIDS_DIR)/frontend.pid; \
		sleep 2; \
		echo "   Frontend PID: $$(cat $(PIDS_DIR)/frontend.pid)"; \
	fi

backend: ensure-env
	@mkdir -p $(PIDS_DIR) $(LOGS_DIR)
	@$(MAKE) -s _start-backend
	@echo "Backend running at http://localhost:8000"

frontend:
	@mkdir -p $(PIDS_DIR) $(LOGS_DIR)
	@$(MAKE) -s _start-frontend
	@echo "Frontend running at http://localhost:5173"

down:
	@echo "-> Stopping services..."
	@if [ -f $(PIDS_DIR)/backend.pid ]; then \
		kill $$(cat $(PIDS_DIR)/backend.pid) 2>/dev/null && echo "   Backend stopped" || echo "   Backend was not running"; \
		rm -f $(PIDS_DIR)/backend.pid; \
	fi
	@if [ -f $(PIDS_DIR)/frontend.pid ]; then \
		kill $$(cat $(PIDS_DIR)/frontend.pid) 2>/dev/null && echo "   Frontend stopped" || echo "   Frontend was not running"; \
		rm -f $(PIDS_DIR)/frontend.pid; \
	fi
	@echo "All services stopped."

# -- Dev tools ---------------------------------------------------------------
see:
	open http://localhost:5173
	open http://localhost:8000/docs

logs:
	@mkdir -p $(LOGS_DIR)
	@tail -f $(LOGS_DIR)/backend.log $(LOGS_DIR)/frontend.log

logs-backend:
	@tail -f $(LOGS_DIR)/backend.log

logs-frontend:
	@tail -f $(LOGS_DIR)/frontend.log

clean:
	@$(MAKE) -s down 2>/dev/null || true
	@rm -rf $(PIDS_DIR) $(LOGS_DIR)
	@rm -f $(BACKEND_DIR)/sentinel.db
	@echo "Clean complete."
