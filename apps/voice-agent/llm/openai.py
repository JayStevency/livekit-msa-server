import logging
from typing import List, Optional

import httpx

from .base import LLMProvider, ChatMessage, ChatCompletionResponse

logger = logging.getLogger("voice-agent.llm.openai")


class OpenAIProvider(LLMProvider):
    """OpenAI LLM Provider"""

    def __init__(self, api_key: str, model: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.model = model
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        logger.info(f"Initialized OpenAI provider: model: {self.model}")

    async def chat(
        self,
        messages: List[ChatMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatCompletionResponse:
        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }

        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            result = response.json()

            usage = None
            if result.get("usage"):
                usage = {
                    "prompt_tokens": result["usage"]["prompt_tokens"],
                    "completion_tokens": result["usage"]["completion_tokens"],
                    "total_tokens": result["usage"]["total_tokens"],
                }

            return ChatCompletionResponse(
                content=result["choices"][0]["message"]["content"],
                model=result.get("model", self.model),
                usage=usage,
            )

    def get_model_name(self) -> str:
        return self.model

    def get_provider_type(self) -> str:
        return "openai"
