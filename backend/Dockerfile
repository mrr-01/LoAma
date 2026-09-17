FROM python:3.11-slim

WORKDIR /app

#Prevent Python from writing .pyc file and enable layer buffer logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

#Install system dependecies and clean up apt cache in one layer
    RUN apt-get update && apt-get install -y --no-install-recommends

#Copy and install python packages first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

#Copy Backend Application Source code
COPY . .

#Expose port 8080
EXPOSE 8080

#Container entry execution command
CMD [ "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000" ]
