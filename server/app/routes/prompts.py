import json
import re
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.collection import Collection
from app.models.prompt import Prompt, PromptTag
from app.models.prompt_version import PromptVersion
from app.models.favorite import Favorite
from app.models.prompt_share import PromptShare
from app.models.user import User
from app.schemas.prompt import (
    PromptCreate,
    PromptUpdate,
    PromptShareRequest,
    PromptGenerateRequest,
    PromptGenerateResponse,
    PromptCompareRequest,
    PromptCompareResponse,
    MetricEvaluation,
    ComparisonSummary
)
from app.core.ai_config import validate_ai_configuration, AIValidationError
from app.services.ai_service import ai_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/prompts", tags=["Prompts"])

def format_datetime_str(dt: Optional[datetime]) -> str:
    if not dt:
        return "Date unavailable"
    return dt.strftime("%b %d, %Y %I:%M %p")

def serialize_prompt(prompt: Prompt, user_id: str, user_email_or_db = None, db: Optional[Session] = None) -> dict:
    if isinstance(user_email_or_db, Session):
        db = user_email_or_db
        user_email = ""
    else:
        user_email = user_email_or_db or ""

    is_owner = prompt.user_id == user_id
    
    # Determine current user's role on this prompt
    if is_owner:
        user_role = "Owner"
    else:
        user_share = None
        if user_email and db:
            user_share = db.query(PromptShare).filter(
                PromptShare.prompt_id == prompt.id,
                PromptShare.shared_with_email == user_email.lower()
            ).first()
        raw_role = user_share.role if user_share else "Viewer"
        if "Editor" in raw_role:
            user_role = "Editor"
        elif "Viewer" in raw_role or "View Only" in raw_role:
            user_role = "Viewer"
        else:
            user_role = "Reviewer"

    is_fav = db.query(Favorite).filter(
        Favorite.user_id == user_id,
        Favorite.prompt_id == prompt.id
    ).first() is not None

    shares = [
        {
            "id": s.id,
            "name": s.shared_with_name,
            "email": s.shared_with_email,
            "role": s.role,
            "avatar": s.shared_with_name[:2].upper() if s.shared_with_name else "CO",
            "sharedAt": format_datetime_str(s.created_at)
        }
        for s in prompt.shares
    ]

    current_version_obj = next((v for v in prompt.versions if v.is_current), None)
    if not current_version_obj and prompt.versions:
        current_version_obj = prompt.versions[-1]
    current_review_status = current_version_obj.review_status if current_version_obj and current_version_obj.review_status else "DRAFT"

    versions = [
        {
            "id": v.id,
            "version": v.version_number,
            "commitMessage": v.commit_message,
            "description": v.description or "",
            "diffNotes": v.diff_notes or "",
            "content": v.content,
            "author": v.author_name or "Unknown author",
            "isCurrent": v.is_current,
            "timestamp": format_datetime_str(v.created_at),
            "reviewStatus": v.review_status or "DRAFT",
            "reviewerId": v.reviewer_id,
            "reviewerName": v.reviewer_name,
            "reviewerEmail": v.reviewer_email,
            "reviewMessage": v.review_message or "",
            "reviewFeedback": v.review_feedback or "",
            "reviewRequestedAt": format_datetime_str(v.review_requested_at) if v.review_requested_at else None,
            "reviewedAt": format_datetime_str(v.reviewed_at) if v.reviewed_at else None
        }
        for v in prompt.versions
    ]

    owner_name = prompt.user.name if prompt.user else "User"
    owner_email = prompt.user.email if prompt.user else ""

    # Authoritative collection relationship
    user_cols = [c for c in prompt.collections if c.user_id == prompt.user_id]
    first_col = user_cols[0] if user_cols else None
    col_name = first_col.name if first_col else (prompt.collection_name if prompt.collection_name and prompt.collection_name.lower() != 'general' else None)
    col_id = first_col.id if first_col else None
    collections_list = [
        {
            "id": c.id,
            "name": c.name,
            "icon": c.icon or "FolderKanban",
            "color": c.color or "blue"
        }
        for c in user_cols
    ]

    return {
        "id": prompt.id,
        "userId": prompt.user_id,
        "title": prompt.title,
        "description": prompt.description or "",
        "content": prompt.content,
        "category": prompt.category or "Coding",
        "collection": col_name,
        "collectionId": col_id,
        "collections": collections_list,
        "targetModel": prompt.target_model or "gemini-3.6-flash",
        "version": prompt.version or "v1.0",
        "rating": round(prompt.rating, 1) if prompt.rating is not None else None,
        "ratingCount": prompt.rating_count or 0,
        "testCount": prompt.test_count or 0,
        "avgLatencyMs": prompt.avg_latency_ms or 180,
        "isPrivate": prompt.is_private,
        "isFavorite": is_fav,
        "tags": [t.tag for t in prompt.tags_rel] or ["General"],
        "createdAt": format_datetime_str(prompt.created_at),
        "updatedAt": format_datetime_str(prompt.updated_at),
        "shareLink": f"https://promptcommit.dev/share/{prompt.id}",
        "sharedWith": shares,
        "collaboratorsCount": len(shares),
        "reviewStatus": current_review_status,
        "versions": versions,
        "isOwner": is_owner,
        "ownerName": owner_name,
        "ownerEmail": owner_email,
        "userRole": user_role
    }

@router.post("/generate", response_model=PromptGenerateResponse)
async def generate_prompt_with_ai(
    data: PromptGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Intelligently generates a clean, professional, production-grade prompt from rough user ideas
    using the selected real AI provider (Gemini, Groq, OpenRouter, Mistral AI).
    Corrects spelling mistakes, grammar, and informal shorthand dynamically via AI without mutating original inputs.
    """
    raw_title = (data.title or "").strip()
    raw_desc = (data.description or "").strip()

    if not raw_title and not raw_desc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a Prompt Title or Description first so AI knows what to generate!"
        )

    # Standard Prompt Engineering System Instruction for LLMs
    system_instruction = (
        "You are an expert AI Prompt Engineer.\n\n"
        "The user's title and description are rough natural-language requirements. "
        "They may contain spelling mistakes, grammar mistakes, abbreviations, shorthand, incomplete sentences, or informal wording.\n\n"
        "First understand the user's intended meaning.\n\n"
        "Correct obvious spelling and grammar mistakes when generating the final prompt.\n\n"
        "Do not preserve obvious typographical errors in the generated prompt.\n\n"
        "Preserve the user's original intent.\n\n"
        "Do not invent requirements that are not supported by the user's request.\n\n"
        "Do not unnecessarily expand a simple request into a large unrelated specification.\n\n"
        "Generate a clear, professional, actionable AI prompt.\n\n"
        "Choose the structure and level of detail appropriate for the user's request.\n\n"
        "The final generated prompt must be clean, readable, and ready to use with an AI model."
    )

    user_input_content = f"Title: {raw_title}\nDescription: {raw_desc}\nCategory: {data.category or 'General'}"

    try:
        canonical_provider_id, canonical_provider_name, target_model = validate_ai_configuration(
            data.provider or "Google Gemini",
            data.model or "gemini-3.6-flash"
        )
    except AIValidationError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

    # Call the existing AI Service abstraction
    ai_result = await ai_service.run_prompt(
        provider=canonical_provider_name,
        model=target_model,
        prompt_text=system_instruction,
        input_text=user_input_content,
        temperature=data.temperature or 0.7,
        max_tokens=data.max_tokens or 1024
    )

    output_text = (ai_result.get("output_text") or "").strip()
    status_str = ai_result.get("status") or "success"
    err_msg = ai_result.get("error")

    if status_str != "success" or not output_text:
        return PromptGenerateResponse(
            title=raw_title or "Generated Prompt",
            prompt=output_text or "",
            provider=canonical_provider_name,
            model=target_model,
            status=status_str,
            errorMessage=err_msg or "AI provider is currently unavailable or unconfigured."
        )

    return PromptGenerateResponse(
        title=raw_title or "Generated Prompt",
        prompt=output_text,
        provider=canonical_provider_name,
        model=target_model,
        status="success",
        errorMessage=None
    )

@router.post("/compare", response_model=PromptCompareResponse)
async def compare_prompts(
    data: PromptCompareRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyzes and compares two prompt iterations or distinct prompts using the selected real AI provider.
    Evaluates Clarity, Specificity, Completeness, Structure, and Efficiency (0-100) dynamically based on actual content.
    """
    content_a = (data.promptAContent or "").strip()
    content_b = (data.promptBContent or "").strip()

    if not content_a or not content_b:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both Prompt A and Prompt B must contain valid text content for comparison."
        )

    title_a = data.promptATitle or "Variant A"
    title_b = data.promptBTitle or "Variant B"

    try:
        canonical_provider_id, canonical_provider_name, target_model = validate_ai_configuration(
            data.provider or "Google Gemini",
            data.model or "gemini-3.6-flash"
        )
    except AIValidationError as err:
        return PromptCompareResponse(
            versionA=MetricEvaluation(),
            versionB=MetricEvaluation(),
            comparison=ComparisonSummary(summary="Invalid AI configuration."),
            provider=data.provider or "Google Gemini",
            model=data.model or "gemini-3.6-flash",
            status="error",
            errorMessage=str(err)
        )

    system_instruction = (
        "You are a Principal AI Prompt Engineering Evaluator & Benchmark Specialist.\n\n"
        "Your task is to perform an objective, rigorous, content-grounded evaluation and comparison of two prompt variants.\n\n"
        "Evaluate BOTH prompts independently on a strict 0 to 100 scale across these 5 dimensions:\n"
        "1. Clarity (0-100): Is the objective understandable, unambiguous, well-phrased, and free of confusing statements?\n"
        "2. Specificity (0-100): How precisely does the prompt describe the desired output, operational constraints, edge cases, and parameters without vague generalizations?\n"
        "3. Completeness (0-100): Does the prompt contain all necessary context, role definition, and instructions needed for an AI model to execute the task accurately relative to its objective?\n"
        "4. Structure (0-100): Are instructions organized logically with clear headings, ordered steps, delineated sections, or schema specifications?\n"
        "5. Efficiency (0-100): Does the prompt achieve maximum instructional clarity without unnecessary repetition, filler phrases, conflicting rules, or wasted token overhead? (Evaluate effective token usage, not just length).\n\n"
        "SCORING METHODOLOGY FOR OVERALL:\n"
        "Calculate Overall Score using the exact weighted formula: round(Clarity * 0.25 + Specificity * 0.25 + Completeness * 0.20 + Structure * 0.15 + Efficiency * 0.15)\n\n"
        "You MUST output ONLY valid JSON matching this exact structure without markdown backticks:\n"
        "{\n"
        '  "versionA": {\n'
        '    "clarity": 82,\n'
        '    "specificity": 76,\n'
        '    "completeness": 80,\n'
        '    "structure": 88,\n'
        '    "efficiency": 74,\n'
        '    "overall": 80,\n'
        '    "strengths": ["Clear role definition", "Structured sections"],\n'
        '    "weaknesses": ["Lacks negative constraints"],\n'
        '    "recommendations": ["Add error handling expectations"]\n'
        '  },\n'
        '  "versionB": {\n'
        '    "clarity": 91,\n'
        '    "specificity": 89,\n'
        '    "completeness": 92,\n'
        '    "structure": 94,\n'
        '    "efficiency": 86,\n'
        '    "overall": 90,\n'
        '    "strengths": ["Highly actionable constraints", "Precise schema definitions"],\n'
        '    "weaknesses": [],\n'
        '    "recommendations": []\n'
        '  },\n'
        '  "comparison": {\n'
        '    "improvements": ["+ Clarity", "+ Specificity", "+ Completeness", "+ Structure", "+ Efficiency"],\n'
        '    "regressions": [],\n'
        '    "summary": "Version B significantly improves specificity and operational guardrails."\n'
        '  }\n'
        "}"
    )

    user_payload = (
        f"=== VARIANT A ({title_a}) ===\n"
        f"{content_a}\n\n"
        f"=== VARIANT B ({title_b}) ===\n"
        f"{content_b}"
    )

    ai_result = await ai_service.run_prompt(
        provider=canonical_provider_name,
        model=target_model,
        prompt_text=system_instruction,
        input_text=user_payload,
        temperature=0.2,  # Lower temperature for deterministic, consistent benchmark scoring
        max_tokens=1500
    )

    output_text = (ai_result.get("output_text") or "").strip()
    status_str = ai_result.get("status") or "success"
    err_msg = ai_result.get("error")

    if status_str != "success" or not output_text:
        return PromptCompareResponse(
            versionA=MetricEvaluation(),
            versionB=MetricEvaluation(),
            comparison=ComparisonSummary(summary="Unable to analyze prompt comparison right now."),
            provider=canonical_provider_name,
            model=target_model,
            status=status_str,
            errorMessage=err_msg or "AI provider is currently unavailable or unconfigured."
        )

    # Parse structured JSON from AI output
    try:
        clean_json_str = output_text
        if "```" in clean_json_str:
            clean_json_str = re.sub(r"^```(?:json)?\s*", "", clean_json_str, flags=re.MULTILINE)
            clean_json_str = re.sub(r"```\s*$", "", clean_json_str, flags=re.MULTILINE)
        clean_json_str = clean_json_str.strip()

        # Find first { and last }
        start_idx = clean_json_str.find("{")
        end_idx = clean_json_str.rfind("}")
        if start_idx != -1 and end_idx != -1:
            clean_json_str = clean_json_str[start_idx:end_idx + 1]

        parsed = json.loads(clean_json_str)

        def build_metric_eval(raw_dict: dict) -> MetricEvaluation:
            c = max(0, min(100, int(raw_dict.get("clarity", 70))))
            sp = max(0, min(100, int(raw_dict.get("specificity", 70))))
            comp = max(0, min(100, int(raw_dict.get("completeness", 70))))
            st = max(0, min(100, int(raw_dict.get("structure", 70))))
            eff = max(0, min(100, int(raw_dict.get("efficiency", 70))))
            # Deterministic weighted overall formula
            overall = round(c * 0.25 + sp * 0.25 + comp * 0.20 + st * 0.15 + eff * 0.15)

            return MetricEvaluation(
                clarity=c,
                specificity=sp,
                completeness=comp,
                structure=st,
                efficiency=eff,
                overall=overall,
                strengths=raw_dict.get("strengths", []),
                weaknesses=raw_dict.get("weaknesses", []),
                recommendations=raw_dict.get("recommendations", [])
            )

        v_a = build_metric_eval(parsed.get("versionA", {}))
        v_b = build_metric_eval(parsed.get("versionB", {}))
        comp_dict = parsed.get("comparison", {})
        comp_summary = ComparisonSummary(
            improvements=comp_dict.get("improvements", []),
            regressions=comp_dict.get("regressions", []),
            summary=comp_dict.get("summary", "")
        )

        return PromptCompareResponse(
            versionA=v_a,
            versionB=v_b,
            comparison=comp_summary,
            provider=data.provider or "Google Gemini",
            model=data.model or "gemini-3.6-flash",
            status="success",
            errorMessage=None
        )

    except Exception as e:
        # Fallback if model output was not valid JSON
        return PromptCompareResponse(
            versionA=MetricEvaluation(),
            versionB=MetricEvaluation(),
            comparison=ComparisonSummary(summary=f"Analysis format parsing error: {str(e)}"),
            provider=data.provider or "Google Gemini",
            model=data.model or "gemini-3.6-flash",
            status="error",
            errorMessage=f"Failed to parse AI comparison response: {str(e)}"
        )

@router.post("", status_code=status.HTTP_201_CREATED)
def create_prompt(
    data: PromptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trimmed_title = data.title.strip()
    if not trimmed_title:
        raise HTTPException(status_code=400, detail="Prompt title cannot be empty.")

    # Resolve collection association authoritatively
    assigned_col = None
    col_id_val = data.collectionId if data.collectionId is not None else data.collection_id
    if col_id_val is not None and str(col_id_val).strip() and str(col_id_val).strip().lower() not in ["none", "null", ""]:
        assigned_col = db.query(Collection).filter(
            Collection.id == str(col_id_val).strip(),
            Collection.user_id == current_user.id
        ).first()
        if not assigned_col:
            raise HTTPException(status_code=404, detail="Collection not found or access denied.")
    elif data.collection and str(data.collection).strip() and str(data.collection).strip().lower() not in ["none", "null", "general", ""]:
        clean_cname = str(data.collection).strip()
        assigned_col = db.query(Collection).filter(
            Collection.user_id == current_user.id,
            Collection.name.ilike(clean_cname)
        ).first()
        if not assigned_col:
            assigned_col = Collection(
                user_id=current_user.id,
                name=clean_cname,
                description=f"{clean_cname} prompts collection.",
                icon="FolderKanban",
                color="blue"
            )
            db.add(assigned_col)
            db.flush()

    # Format tags list with precedence: Explicit User Tags > Collection Default Tags > Fallback
    raw_tags = data.tags
    tag_list = []
    if isinstance(raw_tags, list) and len(raw_tags) > 0:
        tag_list = [str(t).strip().replace("#", "") for t in raw_tags if str(t).strip()]
    elif isinstance(raw_tags, str) and raw_tags.strip():
        tag_list = [t.strip().replace("#", "") for t in raw_tags.split(",") if t.strip()]

    if not tag_list:
        if assigned_col and assigned_col.default_tags_list:
            tag_list = list(assigned_col.default_tags_list)
        else:
            tag_list = ["AI", data.category or "General"]

    target_model_val = data.targetModel or data.target_model or "gemini-3.6-flash"
    is_private_val = data.isPrivate if data.isPrivate is not None else (data.is_private if data.is_private is not None else True)

    new_prompt = Prompt(
        user_id=current_user.id,
        title=trimmed_title,
        description=data.description.strip() if data.description else "Custom private prompt created in workspace.",
        content=data.content.strip(),
        category=data.category.strip() if data.category else "Coding",
        collection_name=assigned_col.name if assigned_col else None,
        target_model=target_model_val,
        version="v1.0",
        rating=None,
        rating_count=0,
        test_count=0,
        avg_latency_ms=180,
        is_private=is_private_val
    )
    if assigned_col:
        new_prompt.collections.append(assigned_col)

    db.add(new_prompt)
    db.flush()

    # Add tags
    for tag_str in tag_list:
        db.add(PromptTag(prompt_id=new_prompt.id, tag=tag_str))

    # Add initial v1.0 version commit
    init_version = PromptVersion(
        prompt_id=new_prompt.id,
        version_number="v1.0",
        commit_message="Initial baseline commit",
        description="Initial creation of prompt in private workspace.",
        diff_notes="+ Initial baseline version created",
        content=data.content.strip(),
        author_name=current_user.name or current_user.username or "Unknown author",
        is_current=True
    )
    db.add(init_version)

    db.commit()
    db.refresh(new_prompt)

    return serialize_prompt(new_prompt, current_user.id, current_user.email, db)

@router.get("")
def get_prompts(
    search: Optional[str] = None,
    category: Optional[str] = None,
    collection: Optional[str] = None,
    collectionId: Optional[str] = None,
    collection_id: Optional[str] = None,
    scope: Optional[str] = Query(default="all", description="all, owned, or shared"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve prompts: owned by user, shared with user, or all accessible."""
    owned_ids = [p.id for p in db.query(Prompt.id).filter(Prompt.user_id == current_user.id).all()]
    
    shared_ids = [
        s.prompt_id for s in db.query(PromptShare.prompt_id).filter(
            PromptShare.shared_with_email == current_user.email.lower()
        ).all()
    ]

    if scope == "owned":
        accessible_ids = owned_ids
    elif scope == "shared":
        accessible_ids = shared_ids
    else:
        accessible_ids = list(set(owned_ids + shared_ids))

    if not accessible_ids:
        return []

    query = db.query(Prompt).filter(Prompt.id.in_(accessible_ids))

    # Authoritative filter by collection ID, fallback to collection name
    active_col_id = collectionId or collection_id
    if active_col_id and active_col_id.strip() and active_col_id.strip().lower() != "all":
        query = query.join(Prompt.collections).filter(Collection.id == active_col_id.strip())
    elif collection and collection.strip() and collection.strip().lower() != "all":
        col_clean = collection.strip().lower()
        query = query.join(Prompt.collections).filter(Collection.name.ilike(col_clean))

    if category and category.lower() != "all":
        query = query.filter(Prompt.category.ilike(category.strip()))

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Prompt.title.ilike(s),
                Prompt.description.ilike(s),
                Prompt.content.ilike(s)
            )
        )

    prompts = query.order_by(Prompt.updated_at.desc()).all()
    return [serialize_prompt(p, current_user.id, current_user.email, db) for p in prompts]

@router.get("/{prompt_id}")
def get_prompt_by_id(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get prompt details if owner OR authorized collaborator."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    is_owner = prompt.user_id == current_user.id
    is_shared = False
    if not is_owner:
        is_shared = db.query(PromptShare).filter(
            PromptShare.prompt_id == prompt.id,
            PromptShare.shared_with_email == current_user.email.lower()
        ).first() is not None

    if not is_owner and not is_shared:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    return serialize_prompt(prompt, current_user.id, current_user.email, db)

@router.put("/{prompt_id}")
def update_prompt(
    prompt_id: str,
    data: PromptUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update prompt content if owner OR collaborator with Editor role."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    is_owner = prompt.user_id == current_user.id
    if not is_owner:
        share = db.query(PromptShare).filter(
            PromptShare.prompt_id == prompt.id,
            PromptShare.shared_with_email == current_user.email.lower()
        ).first()
        if not share:
            raise HTTPException(status_code=404, detail="Prompt not found or access denied.")
        
        raw_role = share.role or "Viewer"
        if "Editor" not in raw_role and "Admin" not in raw_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You have {raw_role} access to this prompt. Only Editors or the Owner can edit prompt content."
            )

    if data.title is not None and data.title.strip():
        prompt.title = data.title.strip()
    if data.description is not None:
        prompt.description = data.description.strip()
    if data.content is not None and data.content.strip():
        prompt.content = data.content.strip()
    if data.category is not None:
        prompt.category = data.category.strip()

    # Authoritative collection update
    col_id_val = data.collectionId if data.collectionId is not None else data.collection_id
    if col_id_val is not None:
        cid = str(col_id_val).strip()
        if not cid or cid.lower() in ["none", "null", ""]:
            prompt.collections = []
            prompt.collection_name = None
        else:
            col = db.query(Collection).filter(
                Collection.id == cid,
                Collection.user_id == current_user.id
            ).first()
            if not col:
                raise HTTPException(status_code=404, detail="Collection not found or access denied.")
            prompt.collections = [col]
            prompt.collection_name = col.name
    elif data.collection is not None:
        cname = str(data.collection).strip()
        if not cname or cname.lower() in ["none", "null", "general", ""]:
            prompt.collections = []
            prompt.collection_name = None
        else:
            col = db.query(Collection).filter(
                Collection.user_id == current_user.id,
                Collection.name.ilike(cname)
            ).first()
            if col:
                prompt.collections = [col]
                prompt.collection_name = col.name

    target_model_val = data.targetModel if data.targetModel is not None else data.target_model
    if target_model_val is not None:
        prompt.target_model = target_model_val.strip()
    
    is_private_val = data.isPrivate if data.isPrivate is not None else data.is_private
    if is_private_val is not None and is_owner:
        prompt.is_private = is_private_val
    if data.rating is not None:
        prompt.rating = data.rating

    prompt.updated_at = datetime.now(timezone.utc)

    # Update tags if provided
    if data.tags is not None:
        db.query(PromptTag).filter(PromptTag.prompt_id == prompt.id).delete()
        raw_tags = data.tags
        tag_list = []
        if isinstance(raw_tags, list):
            tag_list = [str(t).strip().replace("#", "") for t in raw_tags if str(t).strip()]
        elif isinstance(raw_tags, str):
            tag_list = [t.strip().replace("#", "") for t in raw_tags.split(",") if t.strip()]
        for tag_str in tag_list:
            db.add(PromptTag(prompt_id=prompt.id, tag=tag_str))

    db.commit()
    db.refresh(prompt)
    return serialize_prompt(prompt, current_user.id, current_user.email, db)

@router.delete("/{prompt_id}")
def delete_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete prompt — ONLY the Owner is authorized."""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    is_owner = prompt.user_id == current_user.id
    is_shared = False
    if not is_owner:
        is_shared = db.query(PromptShare).filter(
            PromptShare.prompt_id == prompt.id,
            PromptShare.shared_with_email == current_user.email.lower()
        ).first() is not None

    if not is_owner and not is_shared:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    if not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the prompt owner can delete this prompt.")

    db.delete(prompt)
    db.commit()
    return {"success": True, "message": "Prompt deleted successfully."}

@router.post("/{prompt_id}/rate")
def rate_prompt(
    prompt_id: str,
    rating: float = Query(..., ge=1.0, le=5.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    is_owner = prompt.user_id == current_user.id
    is_shared = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt.id,
        PromptShare.shared_with_email == current_user.email.lower()
    ).first() is not None

    if not is_owner and not is_shared:
        raise HTTPException(status_code=404, detail="Prompt not found or access denied.")

    if prompt.rating is None or not prompt.rating_count:
        prompt.rating = round(rating, 1)
        prompt.rating_count = 1
    else:
        current_total = prompt.rating * prompt.rating_count
        prompt.rating_count += 1
        prompt.rating = round((current_total + rating) / prompt.rating_count, 1)
    db.commit()
    return {"success": True, "rating": prompt.rating, "ratingCount": prompt.rating_count}

@router.post("/{prompt_id}/share")
def share_prompt(
    prompt_id: str,
    data: PromptShareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.user_id == current_user.id
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    clean_email = data.email.strip().lower()
    share_name = data.name or clean_email.split("@")[0].replace(".", " ").title()

    role = data.role or "Reviewer"
    if "Editor" in role:
        role = "Editor"
    elif "Viewer" in role or "View Only" in role:
        role = "Viewer"
    else:
        role = "Reviewer"

    existing_share = db.query(PromptShare).filter(
        PromptShare.prompt_id == prompt.id,
        PromptShare.shared_with_email == clean_email
    ).first()

    if existing_share:
        existing_share.role = role
        db.commit()
        return {"success": True, "message": f"Updated permissions for {share_name} to {existing_share.role}."}

    new_share = PromptShare(
        prompt_id=prompt.id,
        shared_with_email=clean_email,
        shared_with_name=share_name,
        role=role
    )
    db.add(new_share)
    db.commit()

    return {"success": True, "message": f"Prompt shared with {share_name} as {new_share.role}."}

@router.delete("/{prompt_id}/share/{share_id}")
def remove_collaborator(
    prompt_id: str,
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prompt = db.query(Prompt).filter(
        Prompt.id == prompt_id,
        Prompt.user_id == current_user.id
    ).first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found.")

    share = db.query(PromptShare).filter(
        PromptShare.id == share_id,
        PromptShare.prompt_id == prompt.id
    ).first()

    if share:
        db.delete(share)
        db.commit()

    return {"success": True, "message": "Collaborator removed."}
