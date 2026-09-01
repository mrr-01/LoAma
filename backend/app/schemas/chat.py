# backend/app/schemas/chat.py

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class MessageSchema(BaseModel):
    """Shape of a message in API responses"""
    id: str
    conversation_id: str
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime
    tokens_used: Optional[int] = None

    class Config:
        from_attributes = True  # SQLAlchemy model → Pydantic

class ChatRequest(BaseModel):
    """Shape of incoming chat request"""
    conversation_id: Optional[str] = Field(
        None,
        description="Existing conversation ID, or null for new"
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="User's message"
    )
    model: str = Field(
        default="gemma3-1b:latest",
        description="Model to use"
    )

class ChatResponse(BaseModel):
    """Shape of chat endpoint response"""
    conversation_id: str
    user_message: MessageSchema
    assistant_message: MessageSchema
    generated_at: datetime

class ConversationSchema(BaseModel):
    """Shape of a conversation in API"""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    model_used: str
    message_count: int

    class Config:
        from_attributes = True
