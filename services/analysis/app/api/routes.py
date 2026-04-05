from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
from ..engines.pipeline import analyze
from ..engines.ollama import healthcheck
from ..engines.research import collect_references
from ..engines.assistant import build_grounded_reply
from ..models.contracts import AnalysisRequest, ChatRequest

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"service": "analysis", "ollama": await healthcheck()}


@router.post("/analyze")
async def analyze_route(payload: AnalysisRequest):
    response = analyze(payload)
    response.externalReferences = await collect_references(payload.language, payload.source, response.diagnostics)
    return response


@router.post("/chat")
async def chat_route(payload: ChatRequest):
    async def iterator():
        analysis = analyze(
            AnalysisRequest(
                documentId=payload.documentId,
                sessionId=payload.sessionId,
                language=payload.language,
                source=payload.source,
            )
        )
        analysis.externalReferences = await collect_references(payload.language, payload.source, analysis.diagnostics)
        grounded = build_grounded_reply(payload, analysis)

        for paragraph in grounded.split("\n"):
            yield paragraph + "\n"
            await asyncio.sleep(0)

    return StreamingResponse(iterator(), media_type="text/plain")
