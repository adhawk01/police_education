"""Service layer for AI prompt/answer endpoint."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AIServiceError(Exception):
    """Base AI service error."""


class AIValidationError(AIServiceError):
    """Raised when request payload is invalid."""


class AIService:
    """Calls OpenAI and returns a plain answer string."""

    MAX_PROMPT_CHARS = 1000

    def ask(self, payload: dict[str, Any] | None) -> str:
        """Validate prompt and return model answer text."""
        prompt = (payload or {}).get("prompt")
        if not isinstance(prompt, str):
            raise AIValidationError("prompt must be a string")

        prompt = prompt.strip()
        if not prompt:
            raise AIValidationError("prompt is required")

        print(f">>> Prompt received from caller: {prompt}")

        if len(prompt) > self.MAX_PROMPT_CHARS:
            raise AIValidationError(f"prompt must be at most {self.MAX_PROMPT_CHARS} characters")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AIServiceError("OPENAI_API_KEY is not configured")

        model = os.getenv("OPENAI_MODEL", "gpt-5.4")
        timeout_seconds = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "30"))
        api_url = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/responses")

        body = {
            "model": model,
            "input": prompt,
        }

        request = Request(
            api_url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )

        print(f">>> Calling OpenAI API (model={model}, prompt_len={len(prompt)})")
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                raw_response = response.read().decode("utf-8")
        except HTTPError as exc:
            error_payload = exc.read().decode("utf-8", errors="replace")
            raise AIServiceError(f"OpenAI request failed: {exc.code} {error_payload}") from exc
        except URLError as exc:
            raise AIServiceError(f"OpenAI connection failed: {exc.reason}") from exc
        except Exception as exc:
            raise AIServiceError(f"OpenAI request failed: {exc}") from exc

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as exc:
            raise AIServiceError("OpenAI returned invalid JSON") from exc

        answer = self._extract_answer_text(parsed)
        if not answer:
            raise AIServiceError("OpenAI response did not include answer text")
        print(f">>> OpenAI answer received (answer_len={len(answer)})")
        return answer

    @staticmethod
    def _extract_answer_text(response_json: dict[str, Any]) -> str:
        """Extract text answer from OpenAI Responses API payload."""
        output = response_json.get("output")
        if not isinstance(output, list):
            return ""

        parts: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            for content in item.get("content", []):
                if not isinstance(content, dict):
                    continue
                text = content.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text)

        return "\n".join(parts).strip()

