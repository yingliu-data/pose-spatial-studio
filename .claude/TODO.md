### Phase 1 — Deploy two VMs with GPU backend and secure frontend
#### VM1: Edge (CPU‑only, public)
- DNS (Done)
  - Add `A` records: `pose.yourdomain` → VM1 IP; `api.yourdomain` → VM1 IP.
- OS/Base (Done)
  - Ubuntu 22.04/24.04, firewall (ufw) allow 80/443, SSH from admin IPs only.
  - Install Docker + Compose plugin.
- Reverse proxy & TLS (Done)
  - Nginx for `pose.yourdomain` (serves frontend static) and `api.yourdomain` (proxies to VM2:8000).
  - Certbot (cron/renewal). Enable HTTP/2, gzip, HSTS.
  - Configure WebSocket upgrade for `/socket.io/`.
- Frontend hosting (Done)
  - Build frontend (`npm ci && npm run build`).
  - Copy `dist/` to `/var/www/app` (owned by Nginx user).
- Security (Done)
  - Optional Basic Auth while private testing.
  - Rate limit `/socket.io/` and API.
- Observability (Done)
  - Access logs to `/var/log/nginx`; set log rotation.

#### VM2: GPU App (private behind Edge)
- Proxmox GPU (Done)
  - GPU passthrough completed (as stated).
- OS/Base (Done)
  - Ubuntu 22.04/24.04; ufw allow from VM1 only (and SSH admin IPs).
- NVIDIA stack (Done)
  - Install NVIDIA driver (550+), CUDA 12.6; verify `nvidia-smi`.
  - Install Docker + Compose plugin, NVIDIA Container Toolkit; test `docker run --gpus all ... nvidia-smi`.
- Repo & runtime (Todo)
  - Clone repo to `/opt/pose-vision-studio`.
  - Create `.env` with prod values (host, port, CORS/socket origins, FPS/quality, detection toggles).
  - Prepare bind‑mounts: `/mnt/data/models`, `/var/log/pose-vision-studio`.
- Containerization (Todo)
  - CUDA‑based `backend/Dockerfile` (e.g., `nvidia/cuda:12.6-runtime-ubuntu22.04`).
  - `docker-compose.yml` for `backend` (+ optional `redis`).
  - Healthcheck endpoint `/health`; ensure `uvicorn` uses `0.0.0.0:8000`.
- Networking (Todo)
  - Ensure VM2 only reachable from VM1; no public exposure.
- Performance baselines (Todo)
  - Start with 720p @ 10 FPS, JPEG Q=70. Validate GPU load, end‑to‑end latency, and bandwidth for up to 10 users.

---

### Phase 2 — Agentic LangChain microservice + FE integration
- Microservice (Todo)
  - Create `agent/` FastAPI service container, separate from real‑time backend.
  - Endpoints: `POST /agent/invoke` → `{requestId}`; `GET /agent/result/{requestId}` or Socket.IO namespace `/agent` for push results.
  - Add environment: model provider (OpenAI/Anthropic or local via Ollama/NIM), API keys, tool allowlist, timeouts.
  - Optional queue: Redis + RQ/Celery for robustness.
- Tools & safety (Todo)
  - Implement tool interfaces (e.g., `pose_stats`, `web_search` via SERP API, `system_info`).
  - Enforce allowlist; hard timeout (30s), token/response limits; sanitize outputs.
- Frontend (Todo)
  - Add a button to trigger `POST /agent/invoke` with current session context.
  - Show “thinking” state; subscribe to agent results via Socket.IO; display final text/actions.
- Deployment (Todo)
  - Extend VM2 compose with `agent` (depends on `redis` if used).
  - Add `location /agent/` proxy on VM1 Nginx to VM2 `agent` port.

---

### Phase 3 — Full robotic avatar control
- Data contract (Todo)
  - Standardize backend → FE payload: `landmarks[33]` with `{x,y,z,visibility}`, optional `rotations`, `scale`, `root` calibration.
  - Version the schema (e.g., `pose_v1`).
- Retargeting (Todo)
  - Choose a glTF/VRM humanoid avatar.
  - Implement `three/retarget.ts`: map MediaPipe landmarks → rig bones, apply IK (FABRIK or `three-ik`), smoothing filters (OneEuro/Kalman), and interpolation.
  - Add T‑pose calibration step for the user.
- UX & performance (Todo)
  - Render at 60 FPS on FE; send landmarks at 10–20 Hz; optionally reduce/disable video when showing the avatar.
  - Add UI controls to toggle avatar/video overlay and smoothing strength.
- Safety (Todo)
  - Clamp joint angles and apply constraints to avoid unnatural poses.

---

### Cross‑cutting: Security, Monitoring, CI/CD
- Security (Todo)
  - CORS/socket origins restricted to `https://app.yourdomain`.
  - Secrets via `.env` not in git; per‑service least privilege.
  - Optional Basic Auth/invite code while private; migrate to JWT if needed later.
- Monitoring (Todo)
  - cAdvisor/node‑exporter + Prometheus + Grafana stack (compose) on VM2.
  - Alert on GPU memory near cap, high latency, or WebSocket disconnect spikes.
- Logging (Todo)
  - Backend structured logs; Docker log size limits or logrotate; ship to Loki/ELK if desired.
- CI/CD (Todo)
  - GitHub Actions building Docker images (backend/agent), push to registry.
  - Deploy script on VM2: `docker compose pull && docker compose up -d`. Optionally verify health before switching.
