"""
issues.py - FastAPI router for civic issue reporting, management, and engagement.
Handles full AI pipeline: image analysis, severity classification, duplicate detection,
department routing, notifications, upvotes, verifications, and comments.
"""

import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from firebase_admin_config import get_firestore_client
from routers.auth_middleware import get_current_user
from services import gemini_service
from services import complaint_letter
from services import politician_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Haversine distance (metres between two lat/lng points)
# ---------------------------------------------------------------------------

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Department routing table
# ---------------------------------------------------------------------------

DEPARTMENT_ROUTING: dict = {
    "Pothole":          ("Public Works Department",               "pwd@pune.gov.in"),
    "Water Leakage":    ("Water Supply and Sewerage Board",       "wssb@pune.gov.in"),
    "Streetlight":      ("Electricity Department",                "electricity@pune.gov.in"),
    "Waste Management": ("Municipal Solid Waste Department",       "mswd@pune.gov.in"),
    "Other":            ("Municipal Corporation General Office",   "mcgo@pune.gov.in"),
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LocationModel(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None
    ward: Optional[str] = None
    constituencyId: Optional[str] = None


class IssueCreateRequest(BaseModel):
    title: str
    description: str
    category: str
    mediaUrls: Optional[List[str]] = []
    location: LocationModel


class StatusUpdateRequest(BaseModel):
    status: str


class CommentRequest(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Helper: serialize Firestore timestamps for JSON responses
# ---------------------------------------------------------------------------

def _serialize_doc(doc_dict: dict) -> dict:
    """Convert any Firestore DatetimeWithNanoseconds fields to ISO strings."""
    for key, val in doc_dict.items():
        if hasattr(val, "isoformat"):
            doc_dict[key] = val.isoformat()
        elif isinstance(val, dict):
            doc_dict[key] = _serialize_doc(val)
    return doc_dict


# ---------------------------------------------------------------------------
# Helper: create a notification document
# ---------------------------------------------------------------------------

def _create_notification(db, user_id: str, notif_type: str, issue_id: str, message: str):
    db.collection("notifications").add({
        "userId":    user_id,
        "type":      notif_type,
        "issueId":   issue_id,
        "message":   message,
        "read":      False,
        "createdAt": datetime.now(timezone.utc),
    })


# ===========================================================================
# POST /api/issues  -  Report a new civic issue
# ===========================================================================

@router.post("/issues")
async def create_issue(
    body: IssueCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_client()
    uid = current_user.get("uid")
    now = datetime.now(timezone.utc)

    # ------------------------------------------------------------------
    # 1. AI image analysis (if media provided)
    # ------------------------------------------------------------------
    ai_result = {}
    if body.mediaUrls:
        try:
            ai_result = gemini_service.analyze_issue_image(
                body.mediaUrls[0], body.description
            )
        except Exception as exc:
            # Log but do not abort the request
            print(f"[issues] Image analysis error: {exc}")

    # ------------------------------------------------------------------
    # 2. Severity determination
    # ------------------------------------------------------------------
    ai_severity   = ai_result.get("severity", "medium")
    ai_confidence = ai_result.get("confidence", 0.0)

    if ai_confidence > 0.7:
        severity = ai_severity
    else:
        severity = "medium"

    # Force critical for burst/flood/overflow water leakages
    if body.category == "Water Leakage":
        desc_lower = body.description.lower()
        if any(kw in desc_lower for kw in ["burst", "flood", "overflow"]):
            severity = "critical"

    # ------------------------------------------------------------------
    # 3. Department routing
    # ------------------------------------------------------------------
    dept_name, dept_email = DEPARTMENT_ROUTING.get(
        body.category, DEPARTMENT_ROUTING["Other"]
    )

    # ------------------------------------------------------------------
    # 4. Duplicate detection (within 100 m, same category, not resolved)
    # ------------------------------------------------------------------
    duplicate_of = None
    try:
        existing_issues = (
            db.collection("issues")
            .where("status",   "!=", "resolved")
            .where("category", "==", body.category)
            .stream()
        )
        for existing in existing_issues:
            ex_data = existing.to_dict()
            ex_loc  = ex_data.get("location", {})
            ex_lat  = ex_loc.get("lat")
            ex_lng  = ex_loc.get("lng")
            if ex_lat is not None and ex_lng is not None:
                dist = haversine(
                    body.location.lat, body.location.lng,
                    ex_lat, ex_lng,
                )
                if dist <= 100:
                    duplicate_of = existing.id
                    break
    except Exception as exc:
        print(f"[issues] Duplicate detection error: {exc}")

    # ------------------------------------------------------------------
    # 5. Build and save issue document
    # ------------------------------------------------------------------
    issue_id  = str(uuid.uuid4())
    issue_doc = {
        "id":             issue_id,
        "title":          body.title,
        "description":    body.description,
        "category":       body.category,
        "mediaUrls":      body.mediaUrls or [],
        "location":       body.location.model_dump(),
        "severity":       severity,
        "status":         "open",
        "reportedBy":     uid,
        "department":     dept_name,
        "departmentEmail":dept_email,
        "upvotes":        [],
        "verifiedBy":     [],
        "aiAnalysis":     ai_result,
        "duplicateOf":    duplicate_of,
        "fraudFlagged":   False,
        "riskScore":      0,
        "createdAt":      now,
        "updatedAt":      now,
        "resolvedAt":     None,
    }
    db.collection("issues").document(issue_id).set(issue_doc)

    # ------------------------------------------------------------------
    # 6. Update reporter's stats
    # ------------------------------------------------------------------
    try:
        user_ref  = db.collection("users").document(uid)
        user_snap = user_ref.get()
        if user_snap.exists:
            user_data = user_snap.to_dict()
            user_ref.update({
                "reportsCount":    (user_data.get("reportsCount", 0) + 1),
                "reputationPoints":(user_data.get("reputationPoints", 0) + 10),
            })
        else:
            user_ref.set({
                "reportsCount":    1,
                "reputationPoints":10,
            }, merge=True)
    except Exception as exc:
        print(f"[issues] User update error: {exc}")

    # ------------------------------------------------------------------
    # 7. Background: send complaint e-mail
    # ------------------------------------------------------------------
    background_tasks.add_task(
        complaint_letter.send_complaint_email, issue_doc
    )

    # ------------------------------------------------------------------
    # 8. Return saved document
    # ------------------------------------------------------------------
    response = _serialize_doc(dict(issue_doc))
    return response


# ===========================================================================
# GET /api/issues  -  List issues (public)
# ===========================================================================

@router.get("/issues")
async def list_issues(
    category: Optional[str] = None,
    status:   Optional[str] = None,
    limit:    int = 50,
):
    db = get_firestore_client()
    query = db.collection("issues")

    if category:
        query = query.where("category", "==", category)
    if status:
        query = query.where("status", "==", status)

    query = query.order_by("createdAt", direction="DESCENDING").limit(limit)

    results = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(_serialize_doc(data))

    return results


# ===========================================================================
# GET /api/issues/{issue_id}  -  Single issue (public)
# ===========================================================================

@router.get("/issues/{issue_id}")
async def get_issue(issue_id: str):
    db  = get_firestore_client()
    doc = db.collection("issues").document(issue_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return _serialize_doc(data)


# ===========================================================================
# PATCH /api/issues/{issue_id}/status  -  Update status (protected)
# ===========================================================================

@router.patch("/issues/{issue_id}/status")
async def update_issue_status(
    issue_id: str,
    body: StatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    db        = get_firestore_client()
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue       = issue_doc.to_dict()
    new_status  = body.status
    update_data: dict = {
        "status":    new_status,
        "updatedAt": datetime.now(timezone.utc),
    }

    if new_status == "resolved":
        update_data["resolvedAt"] = datetime.now(timezone.utc)

    issue_ref.update(update_data)

    # Recalculate shame score for constituency
    constituency_id = issue.get("location", {}).get("constituencyId")
    if constituency_id:
        try:
            politician_service.recalculate_shame_score(constituency_id)
        except Exception as exc:
            print(f"[issues] Shame score recalculation error: {exc}")

    # Notify the original reporter
    reporter_uid = issue.get("reportedBy")
    if reporter_uid:
        _create_notification(
            db,
            user_id   = reporter_uid,
            notif_type= "status_update",
            issue_id  = issue_id,
            message   = f"Your issue '{issue.get('title', '')}' status has been updated to '{new_status}'.",
        )

    return {"success": True, "status": new_status}


# ===========================================================================
# POST /api/issues/{issue_id}/upvote  -  Toggle upvote (protected)
# ===========================================================================

@router.post("/issues/{issue_id}/upvote")
async def toggle_upvote(
    issue_id: str,
    current_user: dict = Depends(get_current_user),
):
    db        = get_firestore_client()
    uid       = current_user.get("uid")
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue   = issue_doc.to_dict()
    upvotes = issue.get("upvotes", [])
    adding  = uid not in upvotes

    if adding:
        upvotes.append(uid)
        # Award 5 reputation points to issue owner
        owner_uid = issue.get("reportedBy")
        if owner_uid and owner_uid != uid:
            try:
                owner_ref  = db.collection("users").document(owner_uid)
                owner_snap = owner_ref.get()
                if owner_snap.exists:
                    current_pts = owner_snap.to_dict().get("reputationPoints", 0)
                    owner_ref.update({"reputationPoints": current_pts + 5})
            except Exception as exc:
                print(f"[issues] Upvote reputation error: {exc}")

        # Notify reporter on first upvote
        if len(upvotes) == 1 and owner_uid:
            _create_notification(
                db,
                user_id   = owner_uid,
                notif_type= "upvote",
                issue_id  = issue_id,
                message   = f"Someone upvoted your issue '{issue.get('title', '')}'!",
            )
    else:
        upvotes.remove(uid)

    issue_ref.update({"upvotes": upvotes, "updatedAt": datetime.now(timezone.utc)})
    return {"upvoted": adding, "totalUpvotes": len(upvotes)}


# ===========================================================================
# POST /api/issues/{issue_id}/verify  -  Verify issue (protected)
# ===========================================================================

@router.post("/issues/{issue_id}/verify")
async def verify_issue(
    issue_id: str,
    current_user: dict = Depends(get_current_user),
):
    db        = get_firestore_client()
    uid       = current_user.get("uid")
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue      = issue_doc.to_dict()
    verified_by = issue.get("verifiedBy", [])

    if uid in verified_by:
        return {"message": "Already verified by you", "totalVerifications": len(verified_by)}

    verified_by.append(uid)
    issue_ref.update({
        "verifiedBy": verified_by,
        "updatedAt":  datetime.now(timezone.utc),
    })

    # Award 15 reputation points to verifier
    try:
        verifier_ref  = db.collection("users").document(uid)
        verifier_snap = verifier_ref.get()
        if verifier_snap.exists:
            current_pts = verifier_snap.to_dict().get("reputationPoints", 0)
            verifier_ref.update({"reputationPoints": current_pts + 15})
        else:
            verifier_ref.set({"reputationPoints": 15}, merge=True)
    except Exception as exc:
        print(f"[issues] Verifier reputation error: {exc}")

    # Notify reporter when verifications reach milestone (5)
    reporter_uid = issue.get("reportedBy")
    if len(verified_by) == 5 and reporter_uid:
        _create_notification(
            db,
            user_id   = reporter_uid,
            notif_type= "verification_milestone",
            issue_id  = issue_id,
            message   = f"Your issue '{issue.get('title', '')}' has been verified by 5 community members!",
        )

    return {"verified": True, "totalVerifications": len(verified_by)}


# ===========================================================================
# POST /api/issues/{issue_id}/comments  -  Add comment (protected)
# ===========================================================================

@router.post("/issues/{issue_id}/comments")
async def add_comment(
    issue_id: str,
    body: CommentRequest,
    current_user: dict = Depends(get_current_user),
):
    db        = get_firestore_client()
    uid       = current_user.get("uid")
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")

    comment_id  = str(uuid.uuid4())
    now         = datetime.now(timezone.utc)
    comment_doc = {
        "id":        comment_id,
        "text":      body.text.strip(),
        "authorUid": uid,
        "createdAt": now,
    }

    issue_ref.collection("comments").document(comment_id).set(comment_doc)
    # Bump updatedAt on parent issue
    issue_ref.update({"updatedAt": now})

    return _serialize_doc(dict(comment_doc))


# ===========================================================================
# GET /api/issues/{issue_id}/comments  -  List comments (public)
# ===========================================================================

@router.get("/issues/{issue_id}/comments")
async def get_comments(issue_id: str):
    db        = get_firestore_client()
    issue_ref = db.collection("issues").document(issue_id)
    issue_doc = issue_ref.get()
    if not issue_doc.exists:
        raise HTTPException(status_code=404, detail="Issue not found")

    comments_stream = (
        issue_ref.collection("comments")
        .order_by("createdAt", direction="ASCENDING")
        .stream()
    )

    results = []
    for doc in comments_stream:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(_serialize_doc(data))

    return results
