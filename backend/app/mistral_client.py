import json
import logging
import re
from typing import Any

from fastapi import HTTPException
from mistralai.client import Mistral
from mistralai.client.errors import HTTPValidationError, MistralError, SDKError

from app.config import MISTRAL_API_KEY, MISTRAL_MODEL

logger = logging.getLogger("textToSql.mistral")

# No retry_config is passed anywhere here, so the SDK's own retry machinery
# stays off (its default backoff can span up to an hour, which would just
# hang the request instead of surfacing the rate limit to the user). A 429
# from the free tier's 2-requests/minute cap therefore comes back to us
# immediately, and we translate it into a clear message on the first try.
_client: Mistral | None = None


def _get_client() -> Mistral:
    global _client
    if not MISTRAL_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="MISTRAL_API_KEY n'est pas configurée côté serveur. Ajoutez-la dans backend/.env.",
        )
    if _client is None:
        _client = Mistral(api_key=MISTRAL_API_KEY)
    return _client


def _strip_markdown_fence(raw: str) -> str:
    """Mistral's JSON mode is instructed against it, but occasionally still
    wraps the object in ```json fences — tolerate that rather than fail."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def call_mistral_json(system_prompt: str, user_message: str) -> dict[str, Any]:
    """Calls Mistral's chat completion API in JSON mode and returns the parsed object.

    Raises HTTPException with a French, frontend-ready `detail` message on
    every failure path (missing key, rate limit, malformed output, any other
    API error) so callers can simply propagate it.
    """
    client = _get_client()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    try:
        response = client.chat.complete(
            model=MISTRAL_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1024,
        )
    except (SDKError, HTTPValidationError) as exc:
        status = exc.raw_response.status_code
        if status == 429:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Trop de requêtes vers Mistral (limite du plan gratuit : 2 par minute). "
                    "Réessayez dans quelques secondes."
                ),
            ) from exc
        logger.error("Erreur Mistral (status %s) : %s", status, exc)
        raise HTTPException(
            status_code=502, detail=f"Le service Mistral a renvoyé une erreur ({status})."
        ) from exc
    except MistralError as exc:
        logger.error("Erreur Mistral : %s", exc)
        raise HTTPException(
            status_code=502, detail="Le service Mistral est indisponible pour le moment."
        ) from exc

    raw_content = response.choices[0].message.content
    # The SDK types this as str | list[ContentChunk] | None depending on
    # response mode; JSON mode always returns a plain string, but guard
    # anyway rather than assume.
    if not isinstance(raw_content, str):
        raise HTTPException(
            status_code=502, detail="Le modèle a renvoyé une réponse dans un format inattendu."
        )

    try:
        return json.loads(_strip_markdown_fence(raw_content))
    except json.JSONDecodeError as exc:
        logger.error("Réponse Mistral non-JSON : %s", raw_content[:500])
        raise HTTPException(
            status_code=502,
            detail="Le modèle a renvoyé une réponse mal formée. Réessayez votre question.",
        ) from exc
