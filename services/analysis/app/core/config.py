from pydantic import BaseModel
import os


class Settings(BaseModel):
    ollama_url: str = os.getenv("DEBUGWISE_OLLAMA_URL", "http://localhost:11434")
    default_code_model: str = os.getenv("DEBUGWISE_DEFAULT_CODE_MODEL", "deepseek-coder:6.7b")
    default_reasoning_model: str = os.getenv("DEBUGWISE_DEFAULT_REASONING_MODEL", "deepseek-r1")
    fallback_model: str = os.getenv("DEBUGWISE_FALLBACK_MODEL", "codellama")
    enable_online_research: bool = os.getenv("DEBUGWISE_ENABLE_ONLINE_RESEARCH", "true").lower() == "true"
    github_token: str | None = os.getenv("DEBUGWISE_GITHUB_TOKEN")
    stackexchange_key: str | None = os.getenv("DEBUGWISE_STACKEXCHANGE_KEY")


settings = Settings()
