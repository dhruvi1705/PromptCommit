"""
Authoritative AI Provider and Model Configurations for PromptCommit.

PromptCommit supports EXACTLY these six AI configurations:
1. Google Gemini (Cloud API) -> gemini-3.6-flash
2. Google Gemini (Cloud API) -> gemini-3.7-flash
3. Google Gemini (Cloud API) -> gemini-3.8-flash
4. Groq (Cloud API) -> openai/gpt-oss-20b
5. OpenRouter (Cloud API) -> openrouter/free
6. Mistral AI (Cloud API) -> mistral-small-latest
"""

from typing import Dict, Any, List, Optional, Tuple


class AIValidationError(ValueError):
    """Raised when an AI provider, model, or combination is invalid."""
    pass


SUPPORTED_AI_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "gemini": {
        "id": "gemini",
        "name": "Google Gemini",
        "aliases": ["google gemini", "gemini", "google"],
        "models": [
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.8-flash",
        ],
        "default_model": "gemini-3.6-flash",
    },
    "groq": {
        "id": "groq",
        "name": "Groq",
        "aliases": ["groq"],
        "models": [
            "openai/gpt-oss-20b",
        ],
        "default_model": "openai/gpt-oss-20b",
    },
    "openrouter": {
        "id": "openrouter",
        "name": "OpenRouter",
        "aliases": ["openrouter"],
        "models": [
            "openrouter/free",
        ],
        "default_model": "openrouter/free",
    },
    "mistral": {
        "id": "mistral",
        "name": "Mistral AI",
        "aliases": ["mistral ai", "mistral"],
        "models": [
            "mistral-small-latest",
        ],
        "default_model": "mistral-small-latest",
    },
}

ALL_SUPPORTED_MODELS: List[str] = [
    model
    for provider in SUPPORTED_AI_PROVIDERS.values()
    for model in provider["models"]
]


def normalize_provider_id(provider_str: Optional[str]) -> Optional[str]:
    """
    Normalizes a provider string or alias (e.g. 'Google Gemini', 'gemini', 'Groq')
    into its canonical internal ID ('gemini', 'groq', 'openrouter', 'mistral').
    Returns None if the provider is unsupported.
    """
    if not provider_str:
        return None

    cleaned = provider_str.strip().lower()

    # Exact ID match
    if cleaned in SUPPORTED_AI_PROVIDERS:
        return cleaned

    # Match aliases
    for provider_id, config in SUPPORTED_AI_PROVIDERS.items():
        for alias in config["aliases"]:
            if cleaned == alias or cleaned.startswith(alias):
                return provider_id

    return None


MODEL_ALIASES: Dict[str, List[str]] = {
    "gemini-3.6-flash": ["gemini-3.6-flash", "gemini 3.6 flash", "gemini 3.6", "gemini-3.6"],
    "gemini-3.7-flash": ["gemini-3.7-flash", "gemini 3.7 flash", "gemini 3.7", "gemini-3.7"],
    "gemini-3.8-flash": ["gemini-3.8-flash", "gemini 3.8 flash", "gemini 3.8", "gemini-3.8"],
    "openai/gpt-oss-20b": ["openai/gpt-oss-20b", "gpt oss 20b", "groq gpt oss", "gpt-oss-20b"],
    "openrouter/free": ["openrouter/free", "openrouter free"],
    "mistral-small-latest": ["mistral-small-latest", "mistral small", "mistral-small"],
}


def normalize_model_id(model_str: Optional[str]) -> str:
    """
    Normalizes a model string or display label into its canonical internal ID
    ('gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash',
     'openai/gpt-oss-20b', 'openrouter/free', 'mistral-small-latest').
    Unrecognized models are classified as 'unknown' or 'legacy'.
    """
    if not model_str:
        return "unknown"

    cleaned = model_str.strip().lower()

    # Exact match in supported models
    for m in ALL_SUPPORTED_MODELS:
        if cleaned == m.lower():
            return m

    # Match aliases
    for canonical_id, aliases in MODEL_ALIASES.items():
        for alias in aliases:
            if cleaned == alias or alias in cleaned:
                return canonical_id

    if "legacy" in cleaned:
        return "legacy"
    return "unknown"


def validate_ai_configuration(
    provider_str: Optional[str],
    model_str: Optional[str]
) -> Tuple[str, str, str]:
    """
    Strictly validates the provider and model combination.
    Returns:
        (canonical_provider_id, canonical_provider_name, canonical_model_id)

    Raises:
        AIValidationError: If provider is unsupported, model is unsupported,
                           or model is not supported by the specified provider.
    """
    if not provider_str or not provider_str.strip():
        raise AIValidationError(
            "AI provider is required. Available AI providers: Google Gemini, Groq, OpenRouter, and Mistral AI."
        )

    canonical_provider_id = normalize_provider_id(provider_str)
    if not canonical_provider_id:
        raise AIValidationError(
            f"Unsupported AI provider: '{provider_str}'. Available AI providers: Google Gemini, Groq, OpenRouter, and Mistral AI."
        )

    provider_config = SUPPORTED_AI_PROVIDERS[canonical_provider_id]
    provider_name = provider_config["name"]

    # If model is omitted or empty, use the provider's default model
    if not model_str or not model_str.strip():
        return canonical_provider_id, provider_name, provider_config["default_model"]

    cleaned_model = model_str.strip()

    # Check if model belongs to this provider
    if cleaned_model in provider_config["models"]:
        return canonical_provider_id, provider_name, cleaned_model

    # If model belongs to another provider
    for other_id, other_config in SUPPORTED_AI_PROVIDERS.items():
        if other_id != canonical_provider_id and cleaned_model in other_config["models"]:
            raise AIValidationError(
                f"Selected model '{cleaned_model}' is not supported by provider '{provider_name}'. "
                f"It belongs to '{other_config['name']}'."
            )

    # If model is not recognized at all
    raise AIValidationError(
        f"Unsupported AI model: '{cleaned_model}'. Supported models: {', '.join(ALL_SUPPORTED_MODELS)}"
    )
