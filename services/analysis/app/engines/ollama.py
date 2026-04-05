from collections.abc import AsyncGenerator
import json
import httpx
from ..core.config import settings


async def fetch_available_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(f"{settings.ollama_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            return [item["name"] for item in data.get("models", [])]
    except Exception:
        return []


async def choose_model(prompt: str) -> str:
    lowered = prompt.lower()
    available = await fetch_available_models()
    if any(keyword in lowered for keyword in ["why", "reason", "root cause", "architecture"]):
        preferred = settings.default_reasoning_model
    elif any(keyword in lowered for keyword in ["fix", "patch", "refactor", "syntax"]):
        preferred = settings.default_code_model
    else:
        preferred = settings.fallback_model

    candidates = [
        preferred,
        f"{preferred}:latest",
        settings.default_code_model,
        f"{settings.default_code_model}:latest",
        settings.fallback_model,
        f"{settings.fallback_model}:latest",
    ]

    for candidate in candidates:
        if candidate in available:
            return candidate

    if available:
        return available[0]

    return preferred


async def stream_chat(prompt: str) -> AsyncGenerator[str, None]:
    body = {
        "model": await choose_model(prompt),
        "prompt": prompt,
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            async with client.stream("POST", f"{settings.ollama_url}/api/generate", json=body) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = json.loads(line)
                    yield payload.get("response", "")
    except Exception:
        fallback = (
            "Ollama is unavailable, so DebugWise.AI is answering in deterministic fallback mode. "
            "Start Ollama locally to enable deep reasoning and richer fixes."
        )
        yield fallback


async def healthcheck() -> dict:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(f"{settings.ollama_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            return {"status": "ok", "models": [item["name"] for item in data.get("models", [])]}
    except Exception as error:
        return {"status": "degraded", "message": str(error)}
