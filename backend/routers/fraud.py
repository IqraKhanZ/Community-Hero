from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from routers.auth_middleware import get_current_user
from firebase_admin_config import get_firestore_client
from services.gemini_service import analyze_repair_fraud
from services.complaint_letter import send_fraud_alert_email
from datetime import datetime, timezone

router = APIRouter()


class AfterPhotoRequest(BaseModel):
    after_repair_url: str


@router.post("/issues/{issue_id}/after-photo")
async def submit_after_photo(
    issue_id: str,
    body: AfterPhotoRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_firestore_client()
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue_ref.update({
        "afterRepairUrl": body.after_repair_url,
        "updatedAt": datetime.now(timezone.utc)
    })
    return {"success": True, "message": "After photo saved. Use /verify-repair to run AI fraud check."}


@router.post("/issues/{issue_id}/verify-repair")
async def verify_repair(
    issue_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_firestore_client()
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue = {"id": issue_id, **issue_doc.to_dict()}
    before_url = issue.get("beforeRepairUrl") or (
        issue.get("mediaUrls", [None])[0] if issue.get("mediaUrls") else None
    )
    after_url = issue.get("afterRepairUrl")
    if not before_url:
        raise HTTPException(status_code=400, detail="No before photo available")
    if not after_url:
        raise HTTPException(status_code=400, detail="No after photo uploaded yet")

    result = analyze_repair_fraud(before_url, after_url)
    verdict = result.get("verdict", "SUSPICIOUS")
    uid = current_user.get("uid")

    if verdict in ["SUSPICIOUS", "FAKE"]:
        issue_ref.update({
            "fraudFlagged": True,
            "fraudVerdict": verdict,
            "fraudAnalysis": result,
            "status": "open",
            "updatedAt": datetime.now(timezone.utc)
        })
        db.collection("notifications").add({
            "userId": issue.get("reportedBy"),
            "type": "fraud_detected",
            "issueId": issue_id,
            "message": "AI detected a potentially fake repair on your issue. It has been reopened.",
            "read": False,
            "createdAt": datetime.now(timezone.utc)
        })
        try:
            send_fraud_alert_email(issue)
        except Exception:
            pass
    else:
        issue_ref.update({
            "fraudFlagged": False,
            "fraudVerdict": "GENUINE",
            "fraudAnalysis": result,
            "updatedAt": datetime.now(timezone.utc)
        })
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if user_doc.exists:
            current_points = user_doc.to_dict().get("reputationPoints", 0)
            user_ref.update({"reputationPoints": current_points + 25})

    return {"verdict": verdict, "analysis": result}
