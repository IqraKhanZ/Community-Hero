from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from routers.auth_middleware import get_current_user
from services.gemini_service import civicbot_chat
from firebase_admin_config import get_firestore_client
from datetime import datetime, timezone

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_location: Optional[dict] = None
    current_page: Optional[str] = None


@router.post("/agent/chat")
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    user_context = {
        "uid": current_user.get("uid"),
        "page": request.current_page,
        "location": request.user_location
    }
    last_message = request.messages[-1].content.lower() if request.messages else ""
    db = get_firestore_client()
    uid = current_user.get("uid")

    # Agentic: check user issues
    if "check my issues" in last_message or "my reports" in last_message or "meri report" in last_message:
        issues = list(db.collection("issues").where("reportedBy", "==", uid).limit(5).stream())
        issues_summary = "\n".join([
            f"- {i.to_dict().get('title', 'N/A')}: {i.to_dict().get('status', 'N/A')}"
            for i in issues
        ])
        user_context["user_issues_summary"] = issues_summary or "No issues found."

    # Agentic: nearby issues
    if ("near me" in last_message or "nearby" in last_message or "paas" in last_message) and request.user_location:
        user_context["nearby_query"] = True
        nearby = list(db.collection("issues").where("status", "!=", "resolved").limit(20).stream())
        user_context["nearby_hint"] = f"User is at lat={request.user_location.get('lat')}, lng={request.user_location.get('lng')}"

    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    response = civicbot_chat(messages, user_context)
    return {"response": response, "timestamp": datetime.now(timezone.utc).isoformat()}
