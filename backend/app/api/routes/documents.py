# backend/app/api/routes/documents.py

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from pypdf import PdfReader
from io import BytesIO
from typing import Optional

router = APIRouter(prefix="/api", tags=["documents"])

@router.post("/upload/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Extract text from PDF without triggering auto-summary."""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        contents = await file.read()
        pdf_file = BytesIO(contents)
        reader = PdfReader(pdf_file)

        extracted_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF (file may be scanned/image-only).")

        return {
            "filename": file.filename,
            "extracted_text": extracted_text[:12000] # Fit context window
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
