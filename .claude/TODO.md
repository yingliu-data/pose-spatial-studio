### Phase 1 — Production deployment with GPU backend, frontend, and CI/CD

#### VM1: Frontend Edge (CPU‑only, public)
- DNS (Done)
  - `robot.yingliu.site` → frontend VM.
- OS/Base (Done)
  - Ubuntu, firewall configured, SSH via Cloudflare tunnel.
- Reverse proxy & TLS (Done)
  - Nginx serves frontend static files and proxies backend traffic.
  - TLS managed by Cloudflare (edge certificates).
  - WebSocket upgrade configured for `/socket.io/`.
- Frontend hosting (Done)
  - Built via GitHub Actions (`npm ci && npm run build`).
  - Deployed to `/var/www/frontend` via rsync, nginx reloaded automatically.
- Security (Done)
  - Cloudflare provides DDoS protection, WAF, and edge TLS.
  - CORS origins restricted to `localhost` and `robot.yingliu.site`.

#### VM2: GPU Backend (private, Cloudflare tunnel access only)
- Proxmox GPU (Done)
  - GPU passthrough completed.
- OS/Base (Done)
  - Ubuntu with Docker, NVIDIA Container Toolkit.
- NVIDIA stack (Done)
  - NVIDIA driver + CUDA installed and verified.
- Backend container (Done)
  - Backend runs in Docker container `pose-spatial-studio-backend` on port `49101`.
  - Health endpoint `/health` verified by CI/CD pipeline after each deploy.
  - Deployment: GitHub Actions rsyncs code → `docker cp` into container → `pip install` → restart.
- Networking (Done)
  - VM2 accessible only via Cloudflare tunnel (`pose-backend-ssh.yingliu.site`).
  - Backend exposed via `pose-backend.yingliu.site` through Cloudflare.

#### CI/CD (Done)
- GitHub Actions workflows on push to `main`:
  - `deploy_backend.yml` — syncs backend code into running container, installs deps, restarts, health checks.
  - `deploy_frontend.yml` — builds frontend with production env, rsyncs to VM1, reloads nginx.
- SSH via Cloudflare tunnel (`cloudflared access ssh`).
- Secrets managed in GitHub Actions (SSH keys, host addresses, backend URL).

#### Remaining Phase 1 items
- Staging environment (Todo)
  - Cloudflare DNS: add `staging.robot.yingliu.site` → VM1, `staging-backend.yingliu.site` → VM2.
  - VM1: add nginx server block serving `/var/www/staging` on staging subdomain.
  - VM2: create second Docker container for staging backend on port `49102`.
  - CORS: add staging origins to backend `config.py`.
  - GitHub Actions: duplicate `deploy_backend.yml` and `deploy_frontend.yml` to trigger on push to `staging` branch, deploying to staging paths/container.
  - Frontend: add `.env.staging` with `VITE_BACKEND_URL=https://staging-backend.yingliu.site`.
  - Git flow: feature branches → merge to `staging` → verify on staging URL → merge to `main` for production.
- Dockerfile (Todo)
  - Create a reproducible `backend/Dockerfile` (CUDA base image) so the container can be rebuilt from scratch.
- docker-compose.yml (Todo)
  - Define `docker-compose.yml` for local dev and production container orchestration.
- CUDA torch pinning (Todo)
  - Pin `torch` and `torchvision` to CUDA-specific versions in `requirements.txt` (e.g., `+cu121`).
- Performance baselines (Todo)
  - Benchmark 720p @ 10 FPS, JPEG Q=70. Validate GPU load, end‑to‑end latency, bandwidth for up to 10 concurrent users.

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
  - Show "thinking" state; subscribe to agent results via Socket.IO; display final text/actions.
- Deployment (Todo)
  - Add `agent` container to compose. Proxy `/agent/` on VM1 nginx to VM2.

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

### Cross‑cutting: Security, Monitoring, Logging

#### Done
- Security: Cloudflare DDoS/WAF/TLS, CORS restricted, secrets in GitHub Actions (not in git).
- CI/CD: GitHub Actions for both frontend and backend with health checks.
- Logging: Backend structured logs to `logs/` directory.

#### Todo
- Monitoring
  - cAdvisor/node‑exporter + Prometheus + Grafana stack on VM2.
  - Alert on GPU memory near cap, high latency, or WebSocket disconnect spikes.
- Advanced logging
  - Docker log size limits or logrotate; ship to Loki/ELK if desired.
