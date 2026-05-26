# OS Case Study — Deployment Guide

## What's here

```
backend/        ← FastAPI scheduling API (deploy on Railway or Render)
  main.py
  requirements.txt

scheduler-frontend/   ← React frontend (deploy on Vercel)
  src/App.jsx         ← fully redesigned with neon dark theme
  index.html          ← fixed title + DM Mono font
```

---

## 1. Deploy the FastAPI backend (Railway — free)

1. Create a free account at https://railway.app
2. New Project → Deploy from GitHub → select your repo
3. Set the root directory to `backend/`
4. Railway auto-detects Python. Add start command:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Copy your Railway URL (e.g. `https://your-app.up.railway.app`)

**Alternative: Render (also free)**
1. New Web Service → connect your repo
2. Root directory: `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

## 2. Connect frontend to backend

In your Vercel project settings, add an environment variable:
```
VITE_API_URL = https://your-railway-or-render-url.app
```

The frontend automatically falls back to client-side scheduling if `VITE_API_URL` is not set.

---

## 3. Redeploy frontend on Vercel

```bash
git add .
git commit -m "feat: FastAPI backend + redesigned neon frontend"
git push
```

Vercel auto-deploys on push.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/nodes` | Default cluster config |
| POST | `/schedule` | Run a scheduling strategy |
| GET | `/compare` | Run all 3 strategies |
| GET | `/benchmark` | Real K8s cgroup benchmark data |

### POST /schedule example

```json
{
  "strategy": "network-aware",
  "jobs": [
    { "id": "j1", "label": "Job 1", "cpu": 1.5, "ram": 4 },
    { "id": "j2", "label": "Job 2", "cpu": 0.5, "ram": 1 }
  ]
}
```

---

## Changes made

### Frontend (App.jsx)
- Full dark theme: black bg, violet/pink/neon cyan palette
- Glowing node cards that highlight on job assignment
- Step-through animation with 220ms delay per job
- Interactive job configurator — add/remove/edit jobs
- Metrics panel: avg latency, jobs placed, balance %, std dev
- Compare tab with BEST badges
- Real K8s benchmark tab with cgroup data
- Fixed: balance score now uses std dev of utilization (not the wrong formula)
- Fixed: page title in `index.html`
- Added: DM Mono font for that terminal aesthetic

### Backend (main.py)
- FastAPI with CORS
- POST /schedule — accepts custom jobs, nodes, and strategy
- GET /compare — runs all 3 strategies at once
- GET /benchmark — real Kubernetes cgroup measurements
- Correct balance formula (std dev, not `1 - max_util`)
- CORS open by default; lock to your Vercel URL for production

---

## Resume bullet (use this)

> Built and deployed a full-stack OS scheduling simulator — FastAPI backend with a React frontend on Vercel, implementing Least-Loaded, Binpack, and Network-Aware scheduling algorithms across a 3-node virtual cluster; containerised CPU-intensive AI workloads with Docker and demonstrated 87.5% throughput reduction under Kubernetes CPU limits via Linux cgroups. Live at https://os-case-study.vercel.app
