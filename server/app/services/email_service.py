import logging
import os
from typing import Dict, Any, Optional
import resend
from app.core.config import settings

logger = logging.getLogger("promptcommit.email")

def build_invitation_html(
    inviter_name: str,
    prompt_name: str,
    role: str,
    invitation_url: str,
    expiration_str: str = "7 days"
) -> str:
    """Build a professional, modern responsive HTML invitation email."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to collaborate on PromptCommit</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }}
    .wrapper {{
      width: 100%;
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }}
    .header {{
      background: #0f172a;
      padding: 32px 40px;
      text-align: left;
    }}
    .brand {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }}
    .brand-title {{
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin: 0;
    }}
    .brand-subtitle {{
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }}
    .content {{
      padding: 36px 40px;
    }}
    .greeting {{
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }}
    .intro {{
      font-size: 15px;
      color: #475569;
      margin-bottom: 24px;
    }}
    .invite-card {{
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 28px;
    }}
    .invite-item {{
      margin-bottom: 10px;
    }}
    .invite-item:last-child {{
      margin-bottom: 0;
    }}
    .invite-label {{
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 2px;
    }}
    .invite-value {{
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
    }}
    .role-badge {{
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      background: #dbeafe;
      color: #1d4ed8;
    }}
    .btn-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .btn {{
      display: inline-block;
      background: #2563eb;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }}
    .btn:hover {{
      background: #1d4ed8;
    }}
    .expiration {{
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-bottom: 24px;
    }}
    .footer {{
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 40px;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">
        <div>
          <div class="brand-title">PROMPTCOMMIT</div>
          <div class="brand-subtitle">AI Prompt Testing & Version Control</div>
        </div>
      </div>
    </div>
    <div class="content">
      <h1 class="greeting">You've been invited to collaborate!</h1>
      <p class="intro">
        <strong>{inviter_name}</strong> has invited you to join their prompt workspace on PromptCommit.
      </p>
      
      <div class="invite-card">
        <div class="invite-item">
          <div class="invite-label">Prompt / Resource</div>
          <div class="invite-value">{prompt_name}</div>
        </div>
        <div class="invite-item" style="margin-top: 14px;">
          <div class="invite-label">Your Assigned Role</div>
          <div class="invite-value"><span class="role-badge">{role}</span></div>
        </div>
      </div>

      <div class="btn-container">
        <a href="{invitation_url}" class="btn" target="_blank" rel="noopener noreferrer">ACCEPT INVITATION</a>
      </div>

      <div class="expiration">
        ⏱ This invitation expires in <strong>{expiration_str}</strong>.
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">If you were not expecting this invitation, you can safely ignore this email.</p>
      <p style="margin: 0;">© PromptCommit • Secure AI Engineering & Collaboration</p>
    </div>
  </div>
</body>
</html>"""

def send_collaboration_invitation(
    recipient_email: str,
    inviter_name: str,
    prompt_name: str,
    role: str,
    invitation_url: str,
    expiration_str: str = "7 days",
    invitation_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Dispatches a real HTML collaboration invitation email via Resend.
    Returns a dictionary with success status and sanitized diagnostic info.
    """
    clean_email = recipient_email.strip().lower()
    api_key = (settings.RESEND_API_KEY or "").strip()

    if not api_key:
        logger.warning(
            f"Email delivery skipped for {clean_email} (invitation_id: {invitation_id}): "
            "RESEND_API_KEY is not configured in server/.env."
        )
        return {
            "success": False,
            "error": "Email provider not configured (RESEND_API_KEY missing).",
            "provider": "resend",
            "delivered": False
        }

    html_content = build_invitation_html(
        inviter_name=inviter_name,
        prompt_name=prompt_name,
        role=role,
        invitation_url=invitation_url,
        expiration_str=expiration_str
    )

    from_address = settings.EMAIL_FROM or "PromptCommit <onboarding@resend.dev>"

    try:
        resend.api_key = api_key
        params = {
            "from": from_address,
            "to": [clean_email],
            "subject": f"You've been invited to collaborate on PromptCommit: {prompt_name}",
            "html": html_content
        }
        
        response = resend.Emails.send(params)
        logger.info(
            f"Email successfully dispatched to {clean_email} via Resend. "
            f"Invitation ID: {invitation_id}, Resend Email ID: {response.get('id', 'N/A')}"
        )
        return {
            "success": True,
            "emailId": response.get("id"),
            "provider": "resend",
            "delivered": True,
            "error": None
        }
    except Exception as e:
        error_msg = str(e)
        logger.error(
            f"Failed to send email to {clean_email} (invitation_id: {invitation_id}): {error_msg}"
        )
        return {
            "success": False,
            "error": error_msg,
            "provider": "resend",
            "delivered": False
        }

def verify_email_configuration() -> Dict[str, Any]:
    """Check if the email service is properly configured."""
    has_key = bool((settings.RESEND_API_KEY or "").strip())
    return {
        "configured": has_key,
        "provider": "resend",
        "sender": settings.EMAIL_FROM,
        "frontendUrl": settings.FRONTEND_URL
    }
