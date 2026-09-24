# LoAMA — Local AI Model Assistant

LoAMA is a privacy-focused, locally-hosted LLM web interface built with a FastAPI backend, vanilla JavaScript frontend, and an Ollama inference engine. Designed with modern DevOps practices in mind, it features containerized services, host-to-container network bridging, automated CI/CD pipelines, and infrastructure automation.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688)
![Docker](https://img.shields.io/badge/docker-enabled-blue)
![Ollama](https://img.shields.io/badge/Ollama-local_inference-black)

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES6+), Nginx
* **Backend:** Python 3.11, FastAPI, Async Httpx, SQLAlchemy, SQLite
* **AI Engine:** Ollama (Local GGUF Models: Qwen3, Gemma3)
* **DevOps Infrastructure:** Docker, Docker Compose, GitHub Actions, Terraform *(in progress)*

---

## 🏗️ System Architecture

```text
  [ Client Browser ]
         │
         ▼ (Port 3000)
   [ Nginx Web Server ] (loama-frontend Container)
         │
         ▼ (Port 8000)
  [ FastAPI Backend ] (loama-backend Container) ───► [ SQLite Database ]
         │
         ▼ (host.docker.internal:11434)
  [ Ollama Daemon ] (Host Machine Service) ─────────► [ Local GGUF Models ]
```

---

## 🚀 Quick Start Guide

> **Note:** Ensure your host system's Ollama service is bound to `0.0.0.0:11434` before launching containerized services.

### Prerequisites

* **Docker & Docker Compose** (version 2.0+)
* **Ollama** ([Download & Install Ollama](https://ollama.com/))
* **Git**

---

### 1. Clone the Repository

```bash
git clone [https://github.com/mrr-01/LoAma.git](https://github.com/mrr-01/LoAma.git)
cd LoAma
```

---

### 2. Configure Ollama Service

Bind your host machine's Ollama daemon to `0.0.0.0` so backend containers can reach it:

1. **Open the systemd override configuration:**
   ```bash
   sudo systemctl edit ollama.service
   ```
2. **Add the host binding environment variable:**
   ```ini
   [Service]
   Environment="OLLAMA_HOST=0.0.0.0:11434"
   ```
3. **Reload systemd and restart Ollama:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart ollama
   ```

---

### 3. Register Local Models

Define custom `Modelfile` configurations for your local GGUF models:

```dockerfile
FROM /absolute/path/to/your/model.gguf

PARAMETER num_ctx 4096
PARAMETER temperature 0.7
```

Register your model tags with Ollama:
```bash
ollama create qwen3:latest -f /path/to/qwen3/Modelfile
ollama create gemma3-1b:latest -f /path/to/gemma3/Modelfile
```

---

### 4. Run via Docker Compose

Start both frontend and backend services in detached mode:

```bash
docker compose up -d --build
```

Verify that all services are running cleanly:
```bash
docker compose ps
```

---

### 5. Open the Application

Launch your web browser and navigate to:

> **👉 `http://localhost:3000`**

Select `qwen3:latest` or `gemma3-1b:latest` from the top dropdown menu to begin streaming chats!

---

## 💻 Alternative: Bare-Metal / Local Setup

If running without Docker:

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OLLAMA_BASE_URL="[http://127.0.0.1:11434](http://127.0.0.1:11434)"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
python3 -m http.server 3000
```

---

## ⚙️ Environment Configuration

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Primary URL used by backend to query Ollama API |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Fallback URL parameter for Ollama service connection |
| `DATABASE_URL` | `sqlite:///./app.db` | Local SQLite database path for persistent chat history |

---

## 🔍 Diagnostic Commands

```bash
# Verify container model discovery
docker exec -it loama-backend python3 -c "import urllib.request; print(urllib.request.urlopen('[http://host.docker.internal:11434/api/tags').read().decode](http://host.docker.internal:11434/api/tags').read().decode)())"
```

```bash
# Stream live backend logs
docker logs -f loama-backend
```

```bash
# Rebuild backend container
docker compose up -d --build backend
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
