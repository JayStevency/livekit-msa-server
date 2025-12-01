import logging
from typing import List, Optional

import httpx

from .base import LLMProvider, ChatMessage, ChatCompletionResponse

logger = logging.getLogger("voice-agent.llm.ollama")


class OllamaProvider(LLMProvider):
    """Ollama LLM Provider"""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model
        logger.info(f"Initialized Ollama provider: {self.base_url}, model: {self.model}")

    async def chat(
        self,
        messages: List[ChatMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatCompletionResponse:
        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": False,
        }

        if temperature is not None or max_tokens is not None:
            payload["options"] = {}
            if temperature is not None:
                payload["options"]["temperature"] = temperature
            if max_tokens is not None:
                payload["options"]["num_predict"] = max_tokens

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

            usage = None
            if result.get("eval_count"):
                usage = {
                    "prompt_tokens": result.get("prompt_eval_count", 0),
                    "completion_tokens": result.get("eval_count", 0),
                    "total_tokens": result.get("prompt_eval_count", 0) + result.get("eval_count", 0),
                }

            return ChatCompletionResponse(
                content=result["message"]["content"],
                model=self.model,
                usage=usage,
            )

    def get_model_name(self) -> str:
        return self.model

    def get_provider_type(self) -> str:
        return "ollama"
