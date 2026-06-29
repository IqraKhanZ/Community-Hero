from fastapi import APIRouter, Depends, HTTPException
from routers.auth_middleware import get_current_user
from firebase_admin_config import get_firestore_client
from services.politician_service import recalculate_shame_score, send_awareness_email
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("/politicians")
async def get_politicians():
    db = get_firestore_client()
    politicians = []
    for pol in db.collection("politicians").stream():
        data = pol.to_dict()
        data["id"] = pol.id
        politicians.append(data)
    politicians.sort(key=lambda p: p.get("shameScore", 0), reverse=True)
    return politicians


@router.get("/politicians/{politician_id}")
async def get_politician(politician_id: str):
    db = get_firestore_client()
    pol_doc = db.collection("politicians").document(politician_id).get()
    if not pol_doc.exists:
        raise HTTPException(status_code=404, detail="Politician not found")
    politician = {"id": politician_id, **pol_doc.to_dict()}
    # Get open issues in their constituency
    issues_stream = db.collection("issues").where(
        "constituencyId", "==", politician_id
    ).where("status", "!=", "resolved").limit(20).stream()
    open_issues = []
    for issue in issues_stream:
        data = issue.to_dict()
        data["id"] = issue.id
        created = data.get("createdAt")
        if created and hasattr(created, "timestamp"):
            data["createdAt"] = created.isoformat()
            days_pending = (datetime.now(timezone.utc) - created).days
            data["daysPending"] = days_pending
        open_issues.append(data)
    politician["openIssues"] = open_issues
    return politician


@router.post("/politicians/{politician_id}/notify")
async def notify_politician(politician_id: str, current_user: dict = Depends(get_current_user)):
    result = send_awareness_email(politician_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to send email"))
    return result


@router.get("/analytics")
async def get_analytics():
    db = get_firestore_client()
    all_issues = list(db.collection("issues").stream())
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_open = 0
    resolved_this_week = 0
    resolution_times = []
    category_counts = {}
    status_counts = {"open": 0, "in_progress": 0, "resolved": 0, "duplicate": 0}
    daily_counts = {}
    area_counts = {}

    for issue_doc in all_issues:
        issue = issue_doc.to_dict()
        status = issue.get("status", "open")
        category = issue.get("category", "Other")
        created = issue.get("createdAt")
        ward = issue.get("location", {}).get("ward", "Unknown")

        if status != "resolved":
            total_open += 1
        if status == "resolved":
            resolved_at = issue.get("resolvedAt")
            if resolved_at and created:
                try:
                    diff_hours = (resolved_at - created).total_seconds() / 3600
                    resolution_times.append(diff_hours)
                except Exception:
                    pass
            if resolved_at and hasattr(resolved_at, "timestamp") and resolved_at >= week_ago:
                resolved_this_week += 1

        status_counts[status] = status_counts.get(status, 0) + 1
        category_counts[category] = category_counts.get(category, 0) + 1
        area_counts[ward] = area_counts.get(ward, 0) + 1

        if created and hasattr(created, "strftime"):
            day_key = created.strftime("%Y-%m-%d")
            daily_counts[day_key] = daily_counts.get(day_key, 0) + 1

    avg_resolution = sum(resolution_times) / len(resolution_times) if resolution_times else 0
    most_reported = max(category_counts, key=category_counts.get) if category_counts else "N/A"

    # Top 5 areas
    top_areas = sorted(area_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    # Last 30 days daily counts
    daily_series = []
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_series.append({"date": day, "count": daily_counts.get(day, 0)})

    # Predictions
    predictions = []
    for pred_doc in db.collection("predictions").order_by("riskScore", direction="DESCENDING").limit(5).stream():
        data = pred_doc.to_dict()
        data["id"] = pred_doc.id
        if "createdAt" in data and hasattr(data["createdAt"], "isoformat"):
            data["createdAt"] = data["createdAt"].isoformat()
        if "predictedDate" in data and hasattr(data["predictedDate"], "isoformat"):
            data["predictedDate"] = data["predictedDate"].isoformat()
        predictions.append(data)

    # Fraud alerts
    fraud_issues = []
    for issue_doc in db.collection("issues").where("fraudFlagged", "==", True).stream():
        data = issue_doc.to_dict()
        data["id"] = issue_doc.id
        if "createdAt" in data and hasattr(data["createdAt"], "isoformat"):
            data["createdAt"] = data["createdAt"].isoformat()
        fraud_issues.append(data)

    return {
        "totalOpen": total_open,
        "resolvedThisWeek": resolved_this_week,
        "avgResolutionHours": round(avg_resolution, 1),
        "mostReportedCategory": most_reported,
        "categoryBreakdown": [{"category": k, "count": v} for k, v in category_counts.items()],
        "statusBreakdown": [{"status": k, "count": v} for k, v in status_counts.items() if v > 0],
        "dailySeries": daily_series,
        "topAreas": [{"area": k, "count": v} for k, v in top_areas],
        "predictions": predictions,
        "fraudAlerts": fraud_issues,
    }
