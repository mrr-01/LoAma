# backend/api/routes/conversations.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services import ChatService, OllamaService
from app.schemas import ConversationSchema, MessageSchema
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["conversations"])

@router.get("/conversations", response_model=List[ConversationSchema])
async def list_conversations(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get all conversations (most recent first)"""
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        conversations = chat_service.get_all_conversations(limit)
        return [conv.to_dict() for conv in conversations]

    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/conversations/{conversation_id}")
async def get_conversation_messages(
    conversation_id: str,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get message history and model details for a conversation"""
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        # Retrieve conversation metadata
        conversation = chat_service.get_conversation(conversation_id)
        messages = chat_service.get_conversation_history(conversation_id, limit)

        return {
            "conversation_id": conversation.id,
            "model_used": conversation.model_used,  # <--- Expose model_used to frontend
            "messages": messages
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching conversation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Delete a conversation"""
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        chat_service.delete_conversation(conversation_id)
        return {"status": "deleted"}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
