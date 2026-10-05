"""
Google OAuth 2.0 Token Verification Service.

Verifies Google ID tokens issued by Google Identity Services (GIS)
using Google's public keys. Returns the verified user payload
(email, name, sub, picture) or raises an error.
"""

from typing import Dict, Any, Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings


class GoogleAuthService:
    """Verifies Google ID tokens and extracts user information."""

    def verify_google_token(self, credential: str) -> Dict[str, Any]:
        """
        Verify a Google ID token and return the decoded payload.

        Args:
            credential: The Google ID token JWT string from GIS.

        Returns:
            Dict with keys: email, name, sub (Google user ID), picture, email_verified

        Raises:
            ValueError: If the token is invalid, expired, or has wrong audience.
        """
        client_id = settings.GOOGLE_CLIENT_ID

        if not client_id:
            raise ValueError(
                "Google OAuth is not configured. "
                "Please set GOOGLE_CLIENT_ID in the server .env file."
            )

        try:
            # Verify the token using Google's public keys
            # This checks: signature, expiry, issuer, and audience (client_id)
            id_info = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                audience=client_id
            )
        except ValueError as e:
            error_str = str(e).lower()
            if "expired" in error_str:
                raise ValueError("Google authentication token has expired. Please try again.")
            elif "audience" in error_str or "client_id" in error_str:
                raise ValueError("Google token was not issued for this application.")
            else:
                raise ValueError(f"Invalid Google authentication token: {str(e)}")

        # Verify the issuer is Google
        issuer = id_info.get("iss", "")
        if issuer not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Google token has an invalid issuer.")

        # Extract and validate required fields
        email = id_info.get("email")
        if not email:
            raise ValueError("Google account does not provide an email address.")

        email_verified = id_info.get("email_verified", False)
        if not email_verified:
            raise ValueError(
                "Google account email is not verified. "
                "Please verify your email with Google first."
            )

        return {
            "email": email.strip().lower(),
            "name": id_info.get("name", ""),
            "sub": id_info.get("sub", ""),
            "picture": id_info.get("picture", ""),
            "email_verified": email_verified
        }


google_auth_service = GoogleAuthService()
