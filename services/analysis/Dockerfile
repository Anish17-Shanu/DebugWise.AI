FROM python:3.13-slim
WORKDIR /app
COPY services/analysis/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/analysis ./services/analysis
CMD ["python", "-m", "uvicorn", "services.analysis.app.main:app", "--app-dir", ".", "--host", "0.0.0.0", "--port", "8000"]

