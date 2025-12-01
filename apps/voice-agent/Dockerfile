FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치 (Faster Whisper + pydub용 ffmpeg)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY llm/ ./llm/
COPY agent.py .

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/.cache/huggingface

# Agent 실행
CMD ["python", "agent.py", "start"]
