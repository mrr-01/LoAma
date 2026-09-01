from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, List, Optional
import logging

from app.models.models import Conversation, Message
from app.services.ollama_service import OllamaService

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self, db: Session, ollama_service: OllamaService):
        self.db = db
        self.ollama = ollama_service

    def create_conversation(self, title: str = None, model: str = "gemma3-1b:latest") -> Conversation:
        conversation = Conversation(
            title=title or "New Conversation",
            model_used=model
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        logger.info(f"Created conversation {conversation.id}")
        return conversation

    def get_conversation(self, conversation_id: str) -> Conversation:
        conversation = self.db.query(Conversation).filter_by(id=conversation_id).first()
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        return conversation

    def get_all_conversations(self, limit: int = 50) -> List[Conversation]:
        return self.db.query(Conversation).order_by(
            Conversation.updated_at.desc()
        ).limit(limit).all()

    def add_message(self, conversation_id: str, role: str, content: str, tokens_used: Optional[int] = None) -> Message:
        conversation = self.get_conversation(conversation_id)
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tokens_used=tokens_used
        )
        self.db.add(message)
        conversation.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(message)
        return message

    def _build_prompt(self, conversation: Conversation, current_message: str) -> str:
        prompt_lines = []
        recent_messages = conversation.messages[-10:]
        for msg in recent_messages:
            role_label = "User" if msg.role == "user" else "Assistant"
            prompt_lines.append(f"{role_label}: {msg.content}")
        prompt_lines.append(f"User: {current_message}")
        prompt_lines.append("Assistant:")
        return "\n".join(prompt_lines)

    def process_user_message(self, conversation_id: str, user_message: str) -> Dict:
        conversation = self.get_conversation(conversation_id)

        # 1. Save user message
        user_msg = self.add_message(conversation_id, "user", user_message)

        # 2. Build complete prompt
        prompt = self._build_prompt(conversation, user_message)

        # 3. Request completion from Ollama using the assigned model
        ollama_response = self.ollama.generate(
            model=conversation.model_used,
            prompt=prompt,
            stream=False
        )

        # 4. Save assistant response
        assistant_msg = self.add_message(
            conversation_id,
            "assistant",
            ollama_response.get("response", "")
        )

        return {
            "conversation_id": conversation_id,
            "user_message": user_msg.to_dict(),
            "assistant_message": assistant_msg.to_dict(),
            "generated_at": datetime.utcnow().isoformat()
        }

    def get_conversation_history(self, conversation_id: str, limit: int = 50) -> List[Dict]:
        self.get_conversation(conversation_id)
        messages = self.db.query(Message).filter_by(
            conversation_id=conversation_id
        ).order_by(Message.created_at.asc()).limit(limit).all()
        return [msg.to_dict() for msg in messages]

    def delete_conversation(self, conversation_id: str) -> None:
        conversation = self.get_conversation(conversation_id)
        self.db.delete(conversation)
        self.db.commit()
