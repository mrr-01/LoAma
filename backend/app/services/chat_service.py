from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, List, Optional, AsyncGenerator
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
        conversation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(message)
        return message

    def _build_prompt(self, conversation: Optional[Conversation], fallback_message: str = "") -> str:
        """Constructs prompt using committed conversation messages without duplicating input."""
        if not conversation:
            return f"User: {fallback_message}\nAssistant:"

        prompt_lines = []
        recent_messages = conversation.messages[-10:]
        for msg in recent_messages:
            role_label = "User" if msg.role == "user" else "Assistant"
            prompt_lines.append(f"{role_label}: {msg.content}")

        prompt_lines.append("Assistant:")
        return "\n".join(prompt_lines)

    def process_user_message(
        self,
        conversation_id: str,
        message_content: str,
        model_name: Optional[str] = None
    ) -> Dict:
        conversation = self.get_conversation(conversation_id)
        selected_model = model_name or conversation.model_used or "gemma3-1b:latest"
        if model_name and conversation.model_used != model_name:
            conversation.model_used = model_name

        user_msg = Message(
            conversation_id=conversation_id,
            role="user",
            content=message_content
        )
        self.db.add(user_msg)

        if conversation.title == "New Conversation":
            conversation.title = self._generate_title(message_content)

        conversation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(user_msg)
        self.db.refresh(conversation)

        full_prompt = self._build_prompt(conversation)

        response_data = self.ollama.generate(
            model=selected_model,
            prompt=full_prompt
        )
        response_text = response_data.get("response", "").strip()

        assistant_msg = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=response_text
        )
        self.db.add(assistant_msg)
        self.db.commit()
        self.db.refresh(assistant_msg)

        return {
            "conversation_id": conversation.id,
            "user_message": user_msg.to_dict(),
            "assistant_message": assistant_msg.to_dict(),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }

    def _generate_title(self, prompt: str) -> str:
        clean_prompt = prompt.strip().split("\n")[0]
        if len(clean_prompt) > 35:
            return clean_prompt[:35].strip() + "..."
        return clean_prompt or "New Conversation"

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

    async def stream_user_message(
        self,
        conversation_id: Optional[str],
        message_content: str,
        model_name: Optional[str] = None,
        system_prompt: Optional[str] = None,
        format_json: bool = False,
        think: bool = False,
        history_enabled: bool = True
    ) -> AsyncGenerator[str, None]:

        conversation = None
        selected_model = model_name or "gemma3-1b:latest"

        # 1. Handle conversation state & database persistence if history is enabled
        if history_enabled and conversation_id:
            conversation = self.get_conversation(conversation_id)
            if model_name and conversation.model_used != model_name:
                conversation.model_used = model_name

            user_msg = Message(
                conversation_id=conversation_id,
                role="user",
                content=message_content
            )
            self.db.add(user_msg)

            if conversation.title == "New Conversation":
                conversation.title = self._generate_title(message_content)

            conversation.updated_at = datetime.now(timezone.utc)
            self.db.commit()

            full_prompt = self._build_prompt(conversation)
        else:
            full_prompt = self._build_prompt(None, fallback_message=message_content)

        # 2. Package options for model behavior
        options = {}
        if think is not None:
            options["think"] = think

        # 3. Stream output from Ollama
        full_response = ""
        async for chunk in self.ollama.generate_stream(
            model=selected_model,
            prompt=full_prompt,
            system_prompt=system_prompt,
            format_json=format_json,
            options=options
        ):
            full_response += chunk
            yield chunk

        # 4. Save final assistant message to database if history is enabled
        if history_enabled and conversation_id and full_response:
            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_response
            )
            self.db.add(assistant_msg)
            self.db.commit()
