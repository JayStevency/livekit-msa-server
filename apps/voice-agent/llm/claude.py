import logging
from typing import List, Optional

import httpx

from .base import LLMProvider, ChatMessage, ChatCompletionResponse

logger = logging.getLogger("voice-agent.llm.claude")


class ClaudeProvider(LLMProvider):
    """Claude (Anthropic) LLM Provider"""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.anthropic.com/v1"
        logger.info(f"Initialized Claude provider: model: {self.model}")

    async def chat(
        self,
        messages: List[ChatMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatCompletionResponse:
        # system 메시지 추출
        system_prompt = None
        chat_messages = []

        for m in messages:
            if m.role == "system":
                if system_prompt:
                    system_prompt += "\n" + m.content
                else:
                    system_prompt = m.content
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        payload = {
            "model": self.model,
            "max_tokens": max_tokens or 4096,
            "messages": chat_messages,
        }

        if system_prompt:
            payload["system"] = system_prompt
        if temperature is not None:
            payload["temperature"] = temperature

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/messages",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            result = response.json()

            content = ""
            if result.get("content"):
                for block in result["content"]:
                    if block.get("type") == "text":
                        content += block.get("text", "")

            usage = None
            if result.get("usage"):
                usage = {
                    "prompt_tokens": result["usage"]["input_tokens"],
                    "completion_tokens": result["usage"]["output_tokens"],
                    "total_tokens": result["usage"]["input_tokens"] + result["usage"]["output_tokens"],
                }

            return ChatCompletionResponse(
                content=content,
                model=result.get("model", self.model),
                usage=usage,
            )

    def get_model_name(self) -> str:
        return self.model

    def get_provider_type(self) -> str:
        return "claude"
