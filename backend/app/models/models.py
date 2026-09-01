# backend/app/models/models.py

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Conversation(Base):
    """
    Represents a chat conversation.

    Why we track:
    - title: Users need to identify conversations
    - model_used: Track which model was used (for context)
    - timestamps: For sorting, debugging
    """
    __tablename__ = "conversations"

    # UUID: unique identifier (better than auto-incrementing int)
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Title auto-generated from first message or user-set
    title = Column(String, default="New Conversation")

    # Track when created/updated (useful for sorting)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Which model was used (in case you switch models)
    model_used = Column(String, default="gemma3-1b:latest")

    # Relationship to messages (one conversation → many messages)
    # cascade="all, delete" means: if conversation deleted, delete its messages too
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "model_used": self.model_used,
            "message_count": len(self.messages)
        }


class Message(Base):
    """
    Individual message in a conversation.

    Why we track:
    - role: "user" or "assistant" (needed to format for API)
    - content: the actual message text
    - tokens_used: for tracking model usage/cost
    """
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Foreign key: which conversation this belongs to
    conversation_id = Column(
        String,
        ForeignKey("conversations.id"),
        nullable=False
    )

    # "user" or "assistant"
    role = Column(String, nullable=False)

    # The message content
    content = Column(Text, nullable=False)

    # When was it created
    created_at = Column(DateTime, default=datetime.utcnow)

    # Optional: track tokens for usage analytics
    tokens_used = Column(Integer, nullable=True)

    # Relationship back to conversation
    conversation = relationship(
        "Conversation",
        back_populates="messages"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
            "tokens_used": self.tokens_used
        }
