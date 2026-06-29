FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set default port for local run, Cloud Run will override this
ENV PORT=8080
EXPOSE 8080

# Shell form of CMD allows environment variable expansion at runtime
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
