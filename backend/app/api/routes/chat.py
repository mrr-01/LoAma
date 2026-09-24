from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.chat_service import ChatService
from app.services.ollama_service import OllamaService, OllamaConnectionError
from app.schemas.chat import ChatRequest, ChatResponse, ChatStreamRequest
import logging
import httpx
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

@router.get("/models")
async def get_available_models():
    """Fetches locally installed models directly from Ollama."""
    ollama_host = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{ollama_host}/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [model["name"] for model in data.get("models", [])]
                if models:
                    return {"models": models}
    except Exception as e:
        logger.error(f"Failed to fetch Ollama models: {e}")

    return {"models": ["gemma3-1b:latest"]}

@router.post("/chat", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        if not request.conversation_id:
            conv = chat_service.create_conversation(model=request.model)
            conversation_id = conv.id
        else:
            conversation_id = request.conversation_id

        result = chat_service.process_user_message(
            conversation_id=conversation_id,
            message_content=request.message,
            model_name=request.model
        )

        logger.info(f"Successfully processed message in {conversation_id} using model {request.model}")
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except OllamaConnectionError as e:
        logger.error(f"Ollama integration error: {e}")
        raise HTTPException(status_code=503, detail="Ollama service unavailable or model missing")
    except Exception as e:
        logger.error(f"Unhandled error in chat route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/chat/stream")
async def stream_message(
    request: ChatStreamRequest,
    db: Session = Depends(get_db)
):
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        # Handle conversation creation if history is enabled
        conv_id = request.conversation_id
        if request.history_enabled and not conv_id:
            conv = chat_service.create_conversation(model=request.model)
            conv_id = conv.id

        # Stream generator passing dynamic flags (think, format_json, system_prompt)
        async def event_generator():
            async for chunk in chat_service.stream_user_message(
                conversation_id=conv_id,
                message_content=request.message,
                model_name=request.model,
                system_prompt=request.system_prompt,
                format_json=request.format_json,
                think=request.think,
                history_enabled=request.history_enabled
            ):
                yield chunk

        headers = {"X-Conversation-Id": conv_id} if conv_id else {}
        return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

    except Exception as e:
        logger.error(f"Error initiating chat stream: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate chat stream")
