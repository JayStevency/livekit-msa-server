import os
import logging
from typing import Optional

from .base import LLMProvider
from .ollama import OllamaProvider
from .openai import OpenAIProvider
from .claude import ClaudeProvider
from .gemini import GeminiProvider

logger = logging.getLogger("voice-agent.llm.factory")


def create_llm_provider(
    provider_type: str,
    **kwargs,
) -> LLMProvider:
    """LLM Provider 팩토리"""
    logger.info(f"Creating LLM provider: {provider_type}")

    if provider_type == "ollama":
        return OllamaProvider(
            base_url=kwargs.get("base_url", "http://localhost:11434"),
            model=kwargs.get("model", "llama3.2:3b"),
        )
    elif provider_type == "openai":
        return OpenAIProvider(
            api_key=kwargs.get("api_key", ""),
            model=kwargs.get("model", "gpt-4o-mini"),
            base_url=kwargs.get("base_url"),
        )
    elif provider_type == "claude":
        return ClaudeProvider(
            api_key=kwargs.get("api_key", ""),
            model=kwargs.get("model", "claude-sonnet-4-20250514"),
        )
    elif provider_type == "gemini":
        return GeminiProvider(
            api_key=kwargs.get("api_key", ""),
            model=kwargs.get("model", "gemini-1.5-flash"),
        )
    else:
        raise ValueError(f"Unknown LLM provider type: {provider_type}")


def get_default_provider() -> LLMProvider:
    """환경 변수 기반 기본 Provider 생성"""
    provider_type = os.getenv("LLM_PROVIDER", "ollama")

    if provider_type == "openai":
        return create_llm_provider(
            "openai",
            api_key=os.getenv("OPENAI_API_KEY", ""),
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            base_url=os.getenv("OPENAI_BASE_URL"),
        )
    elif provider_type == "claude":
        return create_llm_provider(
            "claude",
            api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
        )
    elif provider_type == "gemini":
        return create_llm_provider(
            "gemini",
            api_key=os.getenv("GEMINI_API_KEY", ""),
            model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
        )
    else:
        # Default to Ollama
        return create_llm_provider(
            "ollama",
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            model=os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
        )
