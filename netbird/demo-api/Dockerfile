FROM python:3.12-slim

WORKDIR /app

COPY demo-api.py .

EXPOSE 8080

CMD ["python", "demo-api.py", "--host", "0.0.0.0", "--port", "8080"]
