from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Literal


@dataclass
class ChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass
class ChatCompletionResponse:
    content: str
    model: str
    usage: Optional[dict] = None


class LLMProvider(ABC):
    """LLM Provider 추상 클래스"""

    @abstractmethod
    async def chat(
        self,
        messages: List[ChatMessage],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatCompletionResponse:
        """채팅 완성 요청"""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """모델 이름 반환"""
        pass

    @abstractmethod
    def get_provider_type(self) -> str:
        """프로바이더 타입 반환 (ollama, openai, claude)"""
        pass
