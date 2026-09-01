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
