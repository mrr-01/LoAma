from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.chat_service import ChatService
from app.services.ollama_service import OllamaService, OllamaConnectionError
from app.schemas.chat import ChatRequest, ChatResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        # Handle existing vs new conversation creation
        if not request.conversation_id:
            conv = chat_service.create_conversation(model=request.model)
            conversation_id = conv.id
        else:
            conversation_id = request.conversation_id

        # Process message and generate response from local model
        result = chat_service.process_user_message(
            conversation_id,
            request.message
        )

        logger.info(f"Successfully processed message in {conversation_id}")
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except OllamaConnectionError as e:
        logger.error(f"Ollama integration error: {e}")
        raise HTTPException(status_code=503, detail="Ollama service unavailable or model missing")
    except Exception as e:
        logger.error(f"Unhandled error in chat route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
