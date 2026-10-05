import asyncio
import base64
import time
import logging
from typing import Dict, Any, Optional

httpx = None
try:
    import httpx
except ImportError:
    pass

from google import genai
from google.genai import types

from groq import (
    AsyncGroq,
    AuthenticationError as GroqAuthError,
    RateLimitError as GroqRateLimitError,
    APITimeoutError as GroqTimeoutError,
    APIConnectionError as GroqConnectionError
)

from app.core.config import settings
from app.core.ai_config import validate_ai_configuration, AIValidationError
from app.services.multimedia_processor import (
    MultimediaInput,
    MultimediaProcessor,
    MultimodalNotSupportedError,
    MultimediaValidationError
)

logger = logging.getLogger("promptcommit.ai_service")


class AIService:
    """
    AI Provider Abstraction Service supporting Multimodal Input Pipeline.

    Supported AI Provider Configurations:
    1. Google Gemini: gemini-3.6-flash, gemini-3.7-flash, gemini-3.8-flash (Text, Image Vision, PDF, Code)
    2. Groq: openai/gpt-oss-20b (Text, PDF text extraction, Code)
    3. OpenRouter: openrouter/free (Text, Image Vision via base64 data URL, PDF text extraction, Code)
    4. Mistral: mistral-small-latest (Text, Image Vision via base64 data URL, PDF text extraction, Code)
    """

    async def run_prompt(
        self,
        provider: str,
        model: str,
        prompt_text: str,
        input_text: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        multimedia: Optional[MultimediaInput] = None
    ) -> Dict[str, Any]:

        start_time = time.perf_counter()

        # Authoritative AI Provider & Model Validation
        try:
            canonical_provider_id, canonical_provider_name, target_model = validate_ai_configuration(provider, model)
        except AIValidationError as val_err:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "status": "error",
                "output_text": "",
                "response_time_ms": latency_ms,
                "error": str(val_err),
                "error_code": "INVALID_AI_CONFIGURATION",
                "provider": provider,
                "model": model
            }

        # Check multimodal provider capabilities
        if multimedia and multimedia.input_type and multimedia.input_type != "text":
            try:
                MultimediaProcessor.verify_capability(canonical_provider_id, target_model, multimedia.input_type)
            except MultimodalNotSupportedError as cap_err:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                logger.info(f"Capability rejected: provider={canonical_provider_id} model={target_model} type={multimedia.input_type}")
                return {
                    "status": "error",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": cap_err.message,
                    "error_code": cap_err.code,
                    "provider": canonical_provider_name,
                    "model": target_model
                }

        # Safe logging of input metadata
        if multimedia:
            logger.info(f"Executing prompt with multimedia asset: {multimedia.safe_log_dict()}")

        full_system_prompt = (prompt_text or "").strip()
        user_message = (input_text or "").strip()

        # ============================================================
        # 1. GOOGLE GEMINI (Multimodal: Text, Image, PDF, Code)
        # ============================================================
        if canonical_provider_id == "gemini":

            api_key = settings.GEMINI_API_KEY
            if not api_key:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "unconfigured",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Gemini API key is not configured.",
                    "error_code": "UNCONFIGURED_KEY",
                    "provider": canonical_provider_name,
                    "model": target_model
                }

            client = genai.Client(api_key=api_key)
            if hasattr(client, "interactions") and hasattr(client.interactions, "sdk_configuration"):
                client.interactions.sdk_configuration.retry_config = None

            if full_system_prompt and user_message:
                if full_system_prompt == user_message:
                    combined_text = user_message
                else:
                    combined_text = (
                        f"System Instructions:\n{full_system_prompt}\n\n"
                        f"User Input:\n{user_message}"
                    )
            elif full_system_prompt:
                combined_text = full_system_prompt
            else:
                combined_text = user_message

            # Build multimodal payload for Gemini
            gemini_parts = []
            if multimedia and multimedia.input_type == "image" and multimedia.raw_bytes:
                image_part = types.Part.from_bytes(data=multimedia.raw_bytes, mime_type=multimedia.mime_type)
                gemini_parts = [combined_text, image_part]
            elif multimedia and multimedia.input_type == "pdf" and multimedia.raw_bytes:
                pdf_part = types.Part.from_bytes(data=multimedia.raw_bytes, mime_type="application/pdf")
                extracted_ctx = f"\n\n[PDF Document Extracted Text ({multimedia.filename})]:\n{multimedia.text_content}" if multimedia.text_content else ""
                gemini_parts = [f"{combined_text}{extracted_ctx}", pdf_part]
            elif multimedia and multimedia.input_type == "code" and multimedia.text_content:
                code_text = f"\n\n[Code Attachment ({multimedia.filename}, language={multimedia.language or 'text'})]:\n```{multimedia.language or 'text'}\n{multimedia.text_content}\n```"
                gemini_parts = [f"{combined_text}{code_text}"]
            else:
                gemini_parts = [combined_text]

            gemini_input_payload = gemini_parts if len(gemini_parts) > 1 else gemini_parts[0]

            max_attempts = 3
            backoff_delay = 1.0

            for attempt in range(1, max_attempts + 1):
                attempt_start = time.perf_counter()
                try:
                    async def _call_gemini():
                        return await asyncio.to_thread(
                            client.interactions.create,
                            model=target_model,
                            input=gemini_input_payload
                        )

                    interaction = await asyncio.wait_for(_call_gemini(), timeout=20.0)
                    output_text = interaction.output_text or ""
                    total_latency_ms = int((time.perf_counter() - start_time) * 1000)

                    return {
                        "status": "success",
                        "output_text": output_text,
                        "response_time_ms": total_latency_ms,
                        "error": None,
                        "provider": canonical_provider_name,
                        "model": target_model
                    }

                except asyncio.TimeoutError:
                    total_latency_ms = int((time.perf_counter() - start_time) * 1000)
                    if attempt < max_attempts:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                    else:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": total_latency_ms,
                            "error": "Gemini is temporarily unavailable. Please try again or switch to another AI provider.",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                except Exception as e:
                    total_latency_ms = int((time.perf_counter() - start_time) * 1000)
                    err_status = getattr(e, "status_code", None)
                    err_str = str(e).lower()

                    is_quota = any(k in err_str for k in ["quota", "per day", "daily", "requests per day"])
                    if is_quota:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": total_latency_ms,
                            "error": "Gemini API quota/rate limit exceeded. Please wait or switch to another AI provider.",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    is_permanent = (
                        err_status in (400, 401, 403, 404)
                        or any(k in err_str for k in ["invalid api key", "unauthorized", "forbidden", "model not found", "not supported"])
                    )
                    if is_permanent:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": total_latency_ms,
                            "error": "Gemini is temporarily unavailable. Please try again or switch to another AI provider.",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    is_transient = (
                        err_status in (408, 429, 500, 502, 503, 504)
                        or any(t in type(e).__name__.lower() for t in ["timeout", "connection", "connect", "network"])
                    )

                    if is_transient and attempt < max_attempts:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                    else:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": total_latency_ms,
                            "error": "Gemini is temporarily unavailable. Please try again or switch to another AI provider.",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

        # ============================================================
        # 2. GROQ (Text, PDF text extraction, Code)
        # ============================================================
        elif canonical_provider_id == "groq":
            api_key = settings.GROQ_API_KEY
            if not api_key:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "unconfigured",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Groq API key is not configured. Please set GROQ_API_KEY in your .env file.",
                    "error_code": "UNCONFIGURED_KEY",
                    "provider": canonical_provider_name,
                    "model": target_model
                }

            effective_user_msg = user_message
            if multimedia:
                if multimedia.input_type == "pdf":
                    pdf_text = multimedia.text_content or "No text content could be extracted from PDF."
                    effective_user_msg = f"{effective_user_msg}\n\n[PDF Attachment: {multimedia.filename}]\n{pdf_text}"
                elif multimedia.input_type == "code":
                    effective_user_msg = f"{effective_user_msg}\n\n[Code Attachment: {multimedia.filename} ({multimedia.language or 'text'})]\n```{multimedia.language or 'text'}\n{multimedia.text_content}\n```"

            messages = []
            if full_system_prompt and effective_user_msg:
                if full_system_prompt == effective_user_msg:
                    messages = [{"role": "user", "content": effective_user_msg}]
                else:
                    messages = [
                        {"role": "system", "content": full_system_prompt},
                        {"role": "user", "content": effective_user_msg}
                    ]
            elif full_system_prompt:
                messages = [{"role": "user", "content": full_system_prompt}]
            else:
                messages = [{"role": "user", "content": effective_user_msg}]

            try:
                client = AsyncGroq(api_key=api_key, timeout=30.0)
                completion = await client.chat.completions.create(
                    model=target_model,
                    messages=messages,
                    temperature=temperature if temperature is not None else 0.7,
                    max_tokens=max_tokens if max_tokens is not None else 1024
                )

                latency_ms = int((time.perf_counter() - start_time) * 1000)
                choice = completion.choices[0] if completion.choices else None
                output_text = (choice.message.content or "") if choice and choice.message else ""
                if not output_text and choice and choice.message and getattr(choice.message, "reasoning", None):
                    output_text = choice.message.reasoning or ""

                return {
                    "status": "success",
                    "output_text": output_text,
                    "response_time_ms": latency_ms,
                    "error": None,
                    "provider": canonical_provider_name,
                    "model": target_model
                }

            except GroqAuthError as e:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "error",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Invalid Groq API key. Please check your GROQ_API_KEY in the server .env file.",
                    "provider": canonical_provider_name,
                    "model": target_model
                }
            except GroqRateLimitError as e:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "error",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Groq rate limit reached. Please try again later or select another AI provider.",
                    "provider": canonical_provider_name,
                    "model": target_model
                }
            except (GroqTimeoutError, asyncio.TimeoutError) as e:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "error",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Groq request timed out after 30 seconds. Please try again.",
                    "provider": canonical_provider_name,
                    "model": target_model
                }
            except GroqConnectionError as e:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "error",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Unable to connect to Groq API. Please check your network connection.",
                    "provider": canonical_provider_name,
                    "model": target_model
                }
            except Exception as e:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "error",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": f"Groq API error: {type(e).__name__}. Please try again later.",
                    "provider": canonical_provider_name,
                    "model": target_model
                }

        # ============================================================
        # 3. OPENROUTER (Text, Image Vision, PDF text extraction, Code)
        # ============================================================
        elif canonical_provider_id == "openrouter":
            api_key = settings.OPENROUTER_API_KEY
            if not api_key:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "unconfigured",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your server .env file.",
                    "error_code": "UNCONFIGURED_KEY",
                    "provider": canonical_provider_name,
                    "model": target_model
                }

            effective_user_msg = user_message
            if multimedia:
                if multimedia.input_type == "pdf":
                    pdf_text = multimedia.text_content or "No text content could be extracted from PDF."
                    effective_user_msg = f"{effective_user_msg}\n\n[PDF Attachment: {multimedia.filename}]\n{pdf_text}" if effective_user_msg else f"[PDF Attachment: {multimedia.filename}]\n{pdf_text}"
                elif multimedia.input_type == "code":
                    effective_user_msg = f"{effective_user_msg}\n\n[Code Attachment: {multimedia.filename} ({multimedia.language or 'text'})]\n```{multimedia.language or 'text'}\n{multimedia.text_content}\n```" if effective_user_msg else f"[Code Attachment: {multimedia.filename} ({multimedia.language or 'text'})]\n```{multimedia.language or 'text'}\n{multimedia.text_content}\n```"

            messages = []
            if multimedia and multimedia.input_type == "image" and multimedia.raw_bytes:
                b64_image = base64.b64encode(multimedia.raw_bytes).decode("utf-8")
                mime_type = multimedia.mime_type or "image/png"
                image_data_url = f"data:{mime_type};base64,{b64_image}"

                user_content_parts = []
                if effective_user_msg:
                    user_content_parts.append({"type": "text", "text": effective_user_msg})
                else:
                    user_content_parts.append({"type": "text", "text": "Please analyze this image."})

                user_content_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url
                    }
                })

                user_msg_item = {"role": "user", "content": user_content_parts}
                if full_system_prompt and full_system_prompt != effective_user_msg:
                    messages = [
                        {"role": "system", "content": full_system_prompt},
                        user_msg_item
                    ]
                else:
                    messages = [user_msg_item]
            else:
                if full_system_prompt and effective_user_msg:
                    if full_system_prompt == effective_user_msg:
                        messages = [{"role": "user", "content": effective_user_msg}]
                    else:
                        messages = [
                            {"role": "system", "content": full_system_prompt},
                            {"role": "user", "content": effective_user_msg}
                        ]
                elif full_system_prompt:
                    messages = [{"role": "user", "content": full_system_prompt}]
                else:
                    messages = [{"role": "user", "content": effective_user_msg}]

            endpoint = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "PromptCommit"
            }

            payload = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature if temperature is not None else 0.7,
                "max_tokens": max_tokens if max_tokens is not None else 1024
            }

            max_attempts = 3
            backoff_delay = 1.0

            for attempt in range(1, max_attempts + 1):
                try:
                    if not httpx:
                        raise RuntimeError("httpx package is not installed")
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        resp = await client.post(endpoint, json=payload, headers=headers)

                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    status_code = resp.status_code

                    if status_code == 200:
                        data = resp.json()
                        if "error" in data:
                            err_info = data["error"]
                            err_str = err_info.get("message") if isinstance(err_info, dict) else str(err_info)
                            return {
                                "status": "error",
                                "output_text": "",
                                "response_time_ms": latency_ms,
                                "error": f"OpenRouter API error: {err_str}",
                                "provider": canonical_provider_name,
                                "model": target_model
                            }
                        choices = data.get("choices") or []
                        if not choices:
                            return {
                                "status": "error",
                                "output_text": "",
                                "response_time_ms": latency_ms,
                                "error": "OpenRouter returned no response choices.",
                                "provider": canonical_provider_name,
                                "model": target_model
                            }
                        msg = choices[0].get("message", {}) if choices else {}
                        output_text = msg.get("content") or ""
                        if not output_text and msg.get("reasoning"):
                            output_text = msg.get("reasoning") or ""
                        return {
                            "status": "success",
                            "output_text": output_text,
                            "response_time_ms": latency_ms,
                            "error": None,
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    err_msg = ""
                    try:
                        err_json = resp.json()
                        if isinstance(err_json, dict):
                            if "error" in err_json:
                                if isinstance(err_json["error"], dict):
                                    err_msg = err_json["error"].get("message") or str(err_json["error"])
                                else:
                                    err_msg = str(err_json["error"])
                            elif "message" in err_json:
                                err_msg = str(err_json["message"])
                            elif "detail" in err_json:
                                err_msg = str(err_json["detail"])
                    except Exception:
                        pass
                    if not err_msg:
                        err_msg = resp.text or f"HTTP {status_code}"

                    if status_code in (401, 403):
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": latency_ms,
                            "error": "Invalid OpenRouter API key or unauthorized. Please verify your OPENROUTER_API_KEY.",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    if status_code == 400:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": latency_ms,
                            "error": f"OpenRouter API error: {err_msg}",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    is_transient = status_code in (408, 429, 500, 502, 503, 504)
                    if is_transient and attempt < max_attempts:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    else:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": latency_ms,
                            "error": f"OpenRouter server error: {err_msg}",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                except Exception as exc:
                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    if attempt < max_attempts:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    return {
                        "status": "error",
                        "output_text": "",
                        "response_time_ms": latency_ms,
                        "error": f"OpenRouter error ({type(exc).__name__}): {str(exc)}",
                        "provider": canonical_provider_name,
                        "model": target_model
                    }

        # ============================================================
        # 4. MISTRAL AI (Text, Image Vision, PDF text extraction, Code)
        # ============================================================
        elif canonical_provider_id == "mistral":
            api_key = settings.MISTRAL_API_KEY
            if not api_key:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "unconfigured",
                    "output_text": "",
                    "response_time_ms": latency_ms,
                    "error": "Mistral API key is invalid or unavailable.",
                    "error_code": "UNCONFIGURED_KEY",
                    "provider": canonical_provider_name,
                    "model": target_model
                }

            effective_user_msg = user_message
            if multimedia:
                if multimedia.input_type == "pdf":
                    pdf_text = multimedia.text_content or "No text content could be extracted from PDF."
                    effective_user_msg = f"{effective_user_msg}\n\n[PDF Attachment: {multimedia.filename}]\n{pdf_text}" if effective_user_msg else f"[PDF Attachment: {multimedia.filename}]\n{pdf_text}"
                elif multimedia.input_type == "code":
                    effective_user_msg = f"{effective_user_msg}\n\n[Code Attachment: {multimedia.filename} ({multimedia.language or 'text'})]\n```{multimedia.language or 'text'}\n{multimedia.text_content}\n```" if effective_user_msg else f"[Code Attachment: {multimedia.filename} ({multimedia.language or 'text'})]\n```{multimedia.language or 'text'}\n{multimedia.text_content}\n```"

            messages = []
            if multimedia and multimedia.input_type == "image" and multimedia.raw_bytes:
                b64_image = base64.b64encode(multimedia.raw_bytes).decode("utf-8")
                mime_type = multimedia.mime_type or "image/png"
                image_data_url = f"data:{mime_type};base64,{b64_image}"

                user_content_parts = []
                if effective_user_msg:
                    user_content_parts.append({"type": "text", "text": effective_user_msg})
                else:
                    user_content_parts.append({"type": "text", "text": "Please analyze this image."})

                user_content_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url
                    }
                })

                user_msg_item = {"role": "user", "content": user_content_parts}
                if full_system_prompt and full_system_prompt != effective_user_msg:
                    messages = [
                        {"role": "system", "content": full_system_prompt},
                        user_msg_item
                    ]
                else:
                    messages = [user_msg_item]
            else:
                if full_system_prompt and effective_user_msg:
                    if full_system_prompt == effective_user_msg:
                        messages = [{"role": "user", "content": effective_user_msg}]
                    else:
                        messages = [
                            {"role": "system", "content": full_system_prompt},
                            {"role": "user", "content": effective_user_msg}
                        ]
                elif full_system_prompt:
                    messages = [{"role": "user", "content": full_system_prompt}]
                else:
                    messages = [{"role": "user", "content": effective_user_msg}]

            endpoint = "https://api.mistral.ai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature if temperature is not None else 0.7,
                "max_tokens": max_tokens if max_tokens is not None else 1024
            }

            max_attempts = 3
            backoff_delay = 1.0

            for attempt in range(1, max_attempts + 1):
                try:
                    if not httpx:
                        raise RuntimeError("httpx package is not installed")
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        resp = await client.post(endpoint, json=payload, headers=headers)

                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    status_code = resp.status_code

                    if status_code == 200:
                        data = resp.json()
                        if "error" in data:
                            err_info = data["error"]
                            err_str = err_info.get("message") if isinstance(err_info, dict) else str(err_info)
                            return {
                                "status": "error",
                                "output_text": "",
                                "response_time_ms": latency_ms,
                                "error": f"Mistral API error: {err_str}",
                                "provider": canonical_provider_name,
                                "model": target_model
                            }
                        choices = data.get("choices") or []
                        if not choices:
                            return {
                                "status": "error",
                                "output_text": "",
                                "response_time_ms": latency_ms,
                                "error": "Mistral returned no response choices.",
                                "provider": canonical_provider_name,
                                "model": target_model
                            }
                        msg = choices[0].get("message", {}) if choices else {}
                        output_text = msg.get("content") or ""
                        return {
                            "status": "success",
                            "output_text": output_text,
                            "response_time_ms": latency_ms,
                            "error": None,
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    err_msg = ""
                    try:
                        err_json = resp.json()
                        if isinstance(err_json, dict):
                            if "message" in err_json:
                                err_msg = str(err_json["message"])
                            elif "error" in err_json:
                                if isinstance(err_json["error"], dict):
                                    err_msg = err_json["error"].get("message") or str(err_json["error"])
                                else:
                                    err_msg = str(err_json["error"])
                            elif "detail" in err_json:
                                err_msg = str(err_json["detail"])
                    except Exception:
                        pass
                    if not err_msg:
                        err_msg = resp.text or f"HTTP {status_code}"

                    if status_code in (401, 403):
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": latency_ms,
                            "error": "Mistral API key is invalid or unavailable.",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    if status_code == 400:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": latency_ms,
                            "error": f"Mistral API error: {err_msg}",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                    is_transient = status_code in (408, 429, 500, 502, 503, 504)
                    if is_transient and attempt < max_attempts:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    else:
                        return {
                            "status": "error",
                            "output_text": "",
                            "response_time_ms": latency_ms,
                            "error": f"Mistral is temporarily unavailable: {err_msg}",
                            "provider": canonical_provider_name,
                            "model": target_model
                        }

                except Exception as exc:
                    latency_ms = int((time.perf_counter() - start_time) * 1000)
                    if attempt < max_attempts:
                        await asyncio.sleep(backoff_delay)
                        backoff_delay *= 2.0
                        continue
                    return {
                        "status": "error",
                        "output_text": "",
                        "response_time_ms": latency_ms,
                        "error": f"Mistral error ({type(exc).__name__}): {str(exc)}",
                        "provider": canonical_provider_name,
                        "model": target_model
                    }


        else:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "status": "unconfigured",
                "output_text": "",
                "response_time_ms": latency_ms,
                "error": f"AI provider '{provider}' is not supported.",
                "error_code": "UNSUPPORTED_PROVIDER",
                "provider": provider,
                "model": model
            }


ai_service = AIService()