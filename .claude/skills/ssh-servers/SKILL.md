---
name: ssh-servers
---

SSH into the backend and/or frontend remote servers to inspect, debug, or manage deployed code.

## Prerequisites

Before connecting, ensure the SSH agent has the deploy key loaded:

```bash
ssh-add -l  # Check if keys are loaded
ssh-add ~/.ssh/github_deploy        # RSA key (frontend)
ssh-add ~/.ssh/github_deploy_ed25519 # Ed25519 key (backend)
```

If `github_deploy_ed25519` has wrong permissions:
```bash
chmod 600 ~/.ssh/github_deploy_ed25519
```

## SSH Hosts

Both servers use Cloudflare Tunnels (via `cloudflared access ssh`) as configured in `~/.ssh/config`.

### Backend (GPU Server)

| Field | Value |
|-------|-------|
| SSH alias | `pose-backend` |
| Hostname | `pose-backend-ssh.yingliu.site` |
| User | `root` |
| Key | `~/.ssh/github_deploy_ed25519` |
| App runs in | Docker container `pose-spatial-studio-backend` |
| Code path | `/root/backend/` (inside container) |
| Logs | `/root/backend/logs/app.log` (inside container) |
| Port | 49101 |

**Connect:**
```bash
ssh pose-backend
```

**Interactive shell inside the container:**
```bash
docker exec -it pose-spatial-studio-backend bash
```
This drops you into the container at `/root/backend/` where you can run Python, inspect files, install packages, and debug directly.

**Common commands (run on host, prefix container commands with `docker exec`):**

```bash
# Check backend health
docker exec pose-spatial-studio-backend curl -s http://localhost:49101/health

# View recent logs
docker exec pose-spatial-studio-backend tail -50 /root/backend/logs/app.log

# Inspect deployed code
docker exec pose-spatial-studio-backend cat /root/backend/app.py
docker exec pose-spatial-studio-backend cat /root/backend/config.py
docker exec pose-spatial-studio-backend ls -la /root/backend/processors/

# Check installed packages
docker exec pose-spatial-studio-backend pip list | grep -iE 'mediapipe|rtm|onnx|torch|opencv'

# Check GPU status
docker exec pose-spatial-studio-backend python3 -c "import onnxruntime as ort; print(ort.get_available_providers())"

# Restart the backend app
docker exec pose-spatial-studio-backend bash -c "pkill -f 'python.*app.py'" || true
sleep 2
docker start pose-spatial-studio-backend 2>/dev/null || true
docker exec -d pose-spatial-studio-backend bash -c "cd /root/backend && python app.py >> logs/app.log 2>&1"
```

### Frontend (Nginx Server)

| Field | Value |
|-------|-------|
| SSH alias | `pose-frontend` |
| Hostname | `pose-frontend-ssh.yingliu.site` |
| User | `sophia` |
| Key | `~/.ssh/github_deploy` (RSA) |
| Code path | `/var/www/frontend/` |
| Serves | `https://robot.yingliu.site` |

**Connect:**
```bash
ssh pose-frontend
```

**Common commands:**

```bash
# List deployed files
ls -la /var/www/frontend/
ls -la /var/www/frontend/assets/

# View deployed index.html
cat /var/www/frontend/index.html

# Check nginx status
sudo systemctl status nginx

# Reload nginx after manual changes
sudo systemctl reload nginx
```

## Debugging Workflow

When a problem exists on remote but not locally:

1. **Check logs** on the backend for errors:
   ```bash
   ssh pose-backend "docker exec pose-spatial-studio-backend tail -80 /root/backend/logs/app.log"
   ```

2. **Compare deployed code** with local code:
   ```bash
   ssh pose-backend "docker exec pose-spatial-studio-backend cat /root/backend/<file>" | diff - backend/<file>
   ```

3. **Compare package versions** (common source of discrepancies):
   ```bash
   ssh pose-backend "docker exec pose-spatial-studio-backend pip list" > /tmp/remote-packages.txt
   diff <(cat /tmp/remote-packages.txt) <(cd backend && .venv.nosync/bin/pip list)
   ```

4. **Check frontend build output** — the remote serves a production Vite build, not dev mode:
   ```bash
   ssh pose-frontend "cat /var/www/frontend/index.html"
   ```

## Quick Health Check (No SSH Required)

```bash
curl -s https://pose-backend.yingliu.site/health | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}" https://robot.yingliu.site
```
