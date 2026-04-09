"""Provider-agnostic LLM client abstraction for tiered model escalation.

Supports OpenRouter (via OpenAI SDK) and Anthropic (native SDK) as providers.
Each provider wraps its respective SDK and exposes a uniform interface for
the BrandingAgent to call.
"""

from __future__ import annotations

import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import openai

from .exceptions import APIError
from .rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# Retry configuration shared across providers.
_MAX_RETRIES = 3
_BACKOFF_SECONDS = (5, 15, 60)


@dataclass
class ToolCall:
    """Normalised tool call from an LLM response."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ChatMessage:
    """Normalised assistant message from an LLM response."""

    tool_calls: list[ToolCall] = field(default_factory=list)
    text: str | None = None


@dataclass
class ChatResponse:
    """Normalised LLM response."""

    message: ChatMessage
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0  # Cost in USD (from OpenRouter)


@dataclass
class ModelTier:
    """Configuration for a single model tier."""

    name: str
    provider: str  # "openrouter" or "anthropic"
    model: str
    api_key: str = ""


class LLMClient(ABC):
    """Abstract base class for LLM provider clients."""

    @abstractmethod
    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_choice: str = "required",
        max_tokens: int = 16384,
    ) -> ChatResponse:
        """Send a chat completion request and return a normalised response."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model identifier."""


class OpenRouterClient(LLMClient):
    """OpenRouter provider using the OpenAI SDK."""

    def __init__(self, model: str, api_key: str) -> None:
        self._model = model
        self._client = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self._rate_limiter = RateLimiter()

    @property
    def model_name(self) -> str:
        return self._model

    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_choice: str = "required",
        max_tokens: int = 16384,
    ) -> ChatResponse:
        last_error: Exception | None = None

        for attempt in range(_MAX_RETRIES):
            try:
                self._rate_limiter.wait()
                response = self._client.chat.completions.create(
                    model=self._model,
                    max_tokens=max_tokens,
                    messages=messages,
                    tools=tools,
                    tool_choice=tool_choice,
                )
                return self._normalise(response)

            except openai.RateLimitError as exc:
                last_error = exc
                backoff = _BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)]
                logger.warning("Rate limited (attempt %d/%d), backing off %ds", attempt + 1, _MAX_RETRIES, backoff)
                time.sleep(backoff)

            except openai.APIStatusError as exc:
                if exc.status_code >= 500:
                    last_error = exc
                    backoff = _BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)]
                    logger.warning("Server error %d (attempt %d/%d), backing off %ds", exc.status_code, attempt + 1, _MAX_RETRIES, backoff)
                    time.sleep(backoff)
                else:
                    raise

            except openai.APIConnectionError as exc:
                last_error = exc
                backoff = _BACKOFF_SECONDS[min(attempt, len(_BACKOFF_SECONDS) - 1)]
                logger.warning("Connection error (attempt %d/%d), backing off %ds", attempt + 1, _MAX_RETRIES, backoff)
                time.sleep(backoff)

        raise APIError(f"OpenRouter API unreachable after {_MAX_RETRIES} retries: {last_error}") from last_error

    @staticmethod
    def _normalise(response: Any) -> ChatResponse:
        message = response.choices[0].message
        tool_calls: list[ToolCall] = []

        if message.tool_calls:
            for tc in message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                tool_calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=args))

        input_tokens = response.usage.prompt_tokens if response.usage else 0
        output_tokens = response.usage.completion_tokens if response.usage else 0

        # OpenRouter includes cost in the usage object.
        cost_usd = 0.0
        if response.usage:
            cost_usd = getattr(response.usage, "cost", 0.0) or 0.0

        return ChatResponse(
            message=ChatMessage(tool_calls=tool_calls, text=message.content),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )


def create_client(tier: ModelTier) -> LLMClient:
    """Factory function to create an LLMClient for a model tier.

    All models are accessed via OpenRouter, which can proxy Gemini, Claude,
    and other providers through a single API key.
    """
    return OpenRouterClient(model=tier.model, api_key=tier.api_key)
