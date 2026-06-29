from fastapi import APIRouter, Depends
from routers.auth_middleware import get_current_user
from firebase_admin_config import get_firestore_client
from datetime import datetime, timezone

router = APIRouter()


@router.patch("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = get_firestore_client()
    uid = current_user.get("uid")
    notifs = db.collection("notifications").where(
        "userId", "==", uid
    ).where("read", "==", False).stream()
    batch = db.batch()
    count = 0
    for notif in notifs:
        batch.update(notif.reference, {"read": True})
        count += 1
    if count > 0:
        batch.commit()
    return {"updated": count}


@router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    db = get_firestore_client()
    uid = current_user.get("uid")
    notifs = db.collection("notifications").where(
        "userId", "==", uid
    ).order_by("createdAt", direction="DESCENDING").limit(20).stream()
    result = []
    for n in notifs:
        data = n.to_dict()
        data["id"] = n.id
        if "createdAt" in data and hasattr(data["createdAt"], "isoformat"):
            data["createdAt"] = data["createdAt"].isoformat()
        result.append(data)
    return result
