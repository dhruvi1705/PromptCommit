import io
import re
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

logger = logging.getLogger("promptcommit.multimedia")

# Capability Matrix definition
# Provider -> Model -> Supported input types
# Input types: 'text', 'image', 'pdf', 'code'
SUPPORTED_CAPABILITIES: Dict[str, Dict[str, set]] = {
    "gemini": {
        "gemini-3.6-flash": {"text", "image", "pdf", "code"},
        "gemini-3.7-flash": {"text", "image", "pdf", "code"},
        "gemini-3.8-flash": {"text", "image", "pdf", "code"},
    },
    "groq": {
        "openai/gpt-oss-20b": {"text", "pdf", "code"},  # Text/LLM model: PDF text extraction & Code supported, image vision unsupported
    },
    "openrouter": {
        "openrouter/free": {"text", "image", "pdf", "code"},    # Free model: Text, Image Vision (OpenAI-compatible image_url), PDF text extraction & Code supported
    },
    "mistral": {
        "mistral-small-latest": {"text", "image", "pdf", "code"}, # Mistral Small: Text, Image Vision (image_url chunks), PDF text extraction & Code supported
    }
}

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif"
}

ALLOWED_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

class MultimediaValidationError(Exception):
    def __init__(self, message: str, code: str = "INVALID_MULTIMEDIA_INPUT"):
        super().__init__(message)
        self.message = message
        self.code = code

class MultimodalNotSupportedError(Exception):
    def __init__(self, message: str = "The selected model does not support this input type."):
        super().__init__(message)
        self.message = message
        self.code = "MULTIMODAL_NOT_SUPPORTED"

@dataclass
class MultimediaInput:
    input_type: str  # 'text' | 'image' | 'pdf' | 'code'
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    raw_bytes: Optional[bytes] = None
    text_content: Optional[str] = None
    language: Optional[str] = None

    def safe_log_dict(self) -> Dict[str, Any]:
        """Returns safe telemetry metadata without exposing binary/text payloads."""
        return {
            "input_type": self.input_type,
            "filename": self.filename,
            "mime_type": self.mime_type,
            "file_size_bytes": len(self.raw_bytes) if self.raw_bytes else 0,
            "content_received": bool(self.raw_bytes or self.text_content),
            "language": self.language
        }

class MultimediaProcessor:
    @staticmethod
    def validate_and_create(
        input_type: str,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
        raw_bytes: Optional[bytes] = None,
        text_content: Optional[str] = None,
        language: Optional[str] = None
    ) -> MultimediaInput:
        """
        Validates raw uploaded multimedia asset and returns a normalized MultimediaInput instance.
        """
        normalized_type = (input_type or "text").lower().strip()
        if normalized_type not in ("text", "image", "pdf", "code"):
            normalized_type = "text"

        if normalized_type == "text":
            return MultimediaInput(
                input_type="text",
                text_content=text_content or ""
            )

        if normalized_type == "code":
            if not text_content or not text_content.strip():
                raise MultimediaValidationError("Code content cannot be empty.", code="EMPTY_CODE_CONTENT")
            return MultimediaInput(
                input_type="code",
                filename=filename or "snippet.code",
                mime_type=mime_type or "text/plain",
                text_content=text_content,
                language=language or "text"
            )

        # File-based input validation (Image or PDF)
        if raw_bytes is None:
            raise MultimediaValidationError("No file content received for multimedia attachment.", code="MISSING_FILE_DATA")

        file_size = len(raw_bytes)
        if file_size == 0:
            raise MultimediaValidationError("Uploaded file is empty (0 bytes).", code="EMPTY_FILE")

        if file_size > MAX_FILE_SIZE_BYTES:
            raise MultimediaValidationError(
                f"Uploaded file size ({file_size / (1024*1024):.1f}MB) exceeds the maximum allowed 10MB limit.",
                code="FILE_TOO_LARGE"
            )

        # Sanitize filename
        safe_filename = filename.replace("\\", "/").split("/")[-1] if filename else "file"
        safe_filename = re.sub(r'[^\w\.-]', '_', safe_filename)

        if normalized_type == "image":
            mtype = (mime_type or "").lower().strip()
            # In case generic binary MIME or file extension check
            if not mtype or mtype not in ALLOWED_IMAGE_MIME_TYPES:
                ext = safe_filename.split(".")[-1].lower() if "." in safe_filename else ""
                ext_map = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}
                if ext in ext_map:
                    mtype = ext_map[ext]
                else:
                    raise MultimediaValidationError(
                        f"Unsupported image MIME type or format: '{mime_type or ext}'. Supported formats: PNG, JPG, WebP, GIF.",
                        code="UNSUPPORTED_IMAGE_FORMAT"
                    )

            media = MultimediaInput(
                input_type="image",
                filename=safe_filename,
                mime_type=mtype,
                raw_bytes=raw_bytes
            )
            logger.info(f"Multimedia processed safely: {media.safe_log_dict()}")
            return media

        if normalized_type == "pdf":
            # Extract PDF text
            extracted_text = MultimediaProcessor.extract_pdf_text(raw_bytes)
            media = MultimediaInput(
                input_type="pdf",
                filename=safe_filename,
                mime_type="application/pdf",
                raw_bytes=raw_bytes,
                text_content=extracted_text
            )
            logger.info(f"Multimedia PDF processed safely: {media.safe_log_dict()}")
            return media

        return MultimediaInput(input_type="text", text_content=text_content or "")

    @staticmethod
    def extract_pdf_text(raw_bytes: bytes) -> str:
        """Extract usable text from PDF bytes using pypdf with fallback regex."""
        extracted_text = ""
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
            pages_text = []
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt and txt.strip():
                    pages_text.append(f"--- Page {idx + 1} ---\n{txt.strip()}")
            if pages_text:
                extracted_text = "\n\n".join(pages_text)
        except Exception as err:
            logger.warning(f"pypdf extraction failed, using fallback reader: {err}")

        if not extracted_text or not extracted_text.strip():
            # Fallback binary string extraction for simple PDF streams
            text_matches = re.findall(rb'\(([^\)]+)\)\s*TJ', raw_bytes)
            if not text_matches:
                text_matches = re.findall(rb'Tj\s*\n*\((.*?)\)', raw_bytes)
            if text_matches:
                fallback_parts = []
                for match in text_matches:
                    try:
                        decoded = match.decode('utf-8', errors='ignore').strip()
                        if decoded:
                            fallback_parts.append(decoded)
                    except Exception:
                        pass
                if fallback_parts:
                    extracted_text = " ".join(fallback_parts)

        return extracted_text.strip()

    @staticmethod
    def verify_capability(provider_id: str, model_id: str, input_type: str) -> None:
        """
        Verifies whether the target provider & model support the requested input type.
        Raises MultimodalNotSupportedError if unsupported.
        """
        if input_type in (None, "", "text"):
            return

        provider_caps = SUPPORTED_CAPABILITIES.get(provider_id, {})
        supported_types = provider_caps.get(model_id, set())

        if input_type not in supported_types:
            raise MultimodalNotSupportedError(
                f"The selected model ({model_id}) under provider '{provider_id}' does not support '{input_type}' input attachments."
            )
