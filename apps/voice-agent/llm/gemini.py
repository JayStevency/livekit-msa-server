import logging
from typing import List, Optional

import httpx

from .base import LLMProvider, ChatMessage, ChatCompletionResponse

logger = logging.getLogger("voice-agent.llm.gemini")


class GeminiProvider(LLMProvider):
    """Google Gemini LLM Provider"""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        logger.info(f"Initialized Gemini provider: model: {self.model}")

    async def chat(
        self,
        messages: List[ChatMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatCompletionResponse:
        # system 메시지와 일반 메시지 분리
        system_instruction = None
        contents = []

        for m in messages:
            if m.role == "system":
                if system_instruction:
                    system_instruction += "\n" + m.content
                else:
                    system_instruction = m.content
            else:
                # Gemini는 'assistant' 대신 'model' 사용
                role = "model" if m.role == "assistant" else "user"
                contents.append({
                    "role": role,
                    "parts": [{"text": m.content}]
                })

        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens or 4096,
            },
        }

        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        if temperature is not None:
            payload["generationConfig"]["temperature"] = temperature

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = response.json()

            content = ""
            if result.get("candidates"):
                candidate = result["candidates"][0]
                if candidate.get("content", {}).get("parts"):
                    content = candidate["content"]["parts"][0].get("text", "")

            usage = None
            if result.get("usageMetadata"):
                usage_data = result["usageMetadata"]
                usage = {
                    "prompt_tokens": usage_data.get("promptTokenCount", 0),
                    "completion_tokens": usage_data.get("candidatesTokenCount", 0),
                    "total_tokens": usage_data.get("totalTokenCount", 0),
                }

            return ChatCompletionResponse(
                content=content,
                model=self.model,
                usage=usage,
            )

    def get_model_name(self) -> str:
        return self.model

    def get_provider_type(self) -> str:
        return "gemini"
