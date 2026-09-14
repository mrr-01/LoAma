# LoAMA — Local AI Model Assistant

LoAMA is a privacy-focused, locally-hosted LLM chat interface built with a FastAPI backend, vanilla JavaScript frontend, and an Ollama inference engine. Designed with DevOps practices in mind, it features containerized services, automated CI/CD pipelines, and infrastructure automation.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688)
![Docker](https://img.shields.io/badge/docker-enabled-blue)

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (ES6+), Nginx
* **Backend:** Python 3.11, FastAPI, SQLAlchemy, SQLite
* **AI Engine:** Ollama (`gemma3-1b:latest`, `qwen3:latest`)
* **DevOps Infrastructure:** Docker, Docker Compose, GitHub Actions, Terraform *(in progress)*

---

## 🏗️ System Architecture

```text
  [ Client Browser ]
          │
          ▼ (Port 3000)
    [ Nginx Web Server ]
          │
          ▼ (Port 8000)
    [ FastAPI Backend ] ───► [ SQLite Database ]
          │
          ▼ (Port 11434)
   [ Ollama AI Daemon ] ───► [ Local Models (Gemma / Qwen) ]
   ```


## 🚀 Quick Start Guide

Follow these steps to set up and run LoAMA on your local machine.

### Prerequisites

Ensure you have the following installed:
- **Python 3.10+**
- **Ollama** ([Download & Install Ollama](https://ollama.com/))
- **Git**

---

### 1. Clone the Repository

```bash
git clone [https://github.com/mrr-01/LoAma.git](https://github.com/mrr-01/LoAma.git)
cd LoAma

```
## 2. Setup and Start the Backend
```cd backend
```

# Create and activate a virtual environment
```
python3 -m venv .venv
source .venv/bin/activate
```

# Install dependencies
```
pip install -r requirements.txt
```

# Run the backend API server
```
PYTHONPATH=. python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will now be running at http://localhost:8000. You can inspect the interactive docs at http://localhost:8000/docs

## 3. Start The FRONTEND
```
cd frontend
```

# Serve static frontend files
```
python3 -m http.server 3000
```

## 4. Open The Application
Launch your browser and go to:
```
👉 http://localhost:3000
```
Send a message in the chat box to begin chatting with your local model!
