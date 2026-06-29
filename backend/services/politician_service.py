import os
import math
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content
from firebase_admin_config import get_firestore_client
from services.gemini_service import generate_politician_awareness_email
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

CONSTITUENCIES = [
    {"id": "c1", "name": "Lucknow Central", "centroid": {"lat": 26.845, "lng": 80.940}},
    {"id": "c2", "name": "Lucknow West", "centroid": {"lat": 26.865, "lng": 80.890}},
    {"id": "c3", "name": "Lucknow North", "centroid": {"lat": 26.895, "lng": 80.940}},
    {"id": "c4", "name": "Lucknow East", "centroid": {"lat": 26.870, "lng": 80.980}},
    {"id": "c5", "name": "Lucknow Cantonment", "centroid": {"lat": 26.810, "lng": 80.950}},
    {"id": "c6", "name": "Sarojini Nagar", "centroid": {"lat": 26.760, "lng": 80.880}},
    {"id": "c7", "name": "Bakshi Ka Talab", "centroid": {"lat": 26.980, "lng": 80.930}},
    {"id": "c8", "name": "Mohanlalganj", "centroid": {"lat": 26.680, "lng": 80.970}},
    {"id": "c9", "name": "Hazratganj", "centroid": {"lat": 26.850, "lng": 80.950}},
    {"id": "c10", "name": "Gomti Nagar", "centroid": {"lat": 26.860, "lng": 81.000}},
]

def point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]["lng"], polygon[i]["lat"]
        xj, yj = polygon[j]["lng"], polygon[j]["lat"]
        if ((yi > lng) != (yj > lng)) and (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def haversine_distance(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def find_constituency_for_point(lat: float, lng: float, politicians: list) -> dict | None:
    for pol in politicians:
        bounds = pol.get("constituencyBounds", [])
        if bounds and point_in_polygon(lat, lng, bounds):
            return pol
    min_dist = float("inf")
    nearest = None
    for pol in politicians:
        centroid = next((c for c in CONSTITUENCIES if c["id"] == pol.get("id")), None)
        if centroid:
            dist = haversine_distance(lat, lng, centroid["centroid"]["lat"], centroid["centroid"]["lng"])
            if dist < min_dist:
                min_dist = dist
                nearest = pol
    return nearest

def recalculate_shame_score(constituency_id: str) -> dict:
    db = get_firestore_client()
    issues = list(db.collection("issues").where("constituencyId", "==", constituency_id).stream())
    total = len(issues)
    if total == 0:
        return {"shameScore": 0, "totalIssues": 0, "resolvedIssues": 0, "unresolvedIssues": 0, "avgResolutionDays": 0}
    resolved = []
    unresolved = []
    resolution_days = []
    for issue in issues:
        data = issue.to_dict()
        if data.get("status") == "resolved":
            resolved.append(data)
            created = data.get("createdAt")
            resolved_at = data.get("resolvedAt")
            if created and resolved_at:
                diff = (resolved_at - created).total_seconds() / 86400
                resolution_days.append(diff)
        else:
            unresolved.append(data)
    resolved_count = len(resolved)
    unresolved_count = len(unresolved)
    avg_days = sum(resolution_days) / len(resolution_days) if resolution_days else 0
    shame_score = (unresolved_count / total) * 100 - (resolved_count * 2) + (avg_days * 0.5)
    shame_score = max(0, min(100, shame_score))
    metrics = {
        "shameScore": round(shame_score, 2),
        "totalIssues": total,
        "resolvedIssues": resolved_count,
        "unresolvedIssues": unresolved_count,
        "avgResolutionDays": round(avg_days, 1),
        "updatedAt": datetime.now(timezone.utc)
    }
    pol_query = db.collection("politicians").where("constituencyId", "==", constituency_id).limit(1).stream()
    for pol in pol_query:
        pol.reference.update(metrics)
        break
    return metrics

def send_awareness_email(politician_id: str) -> dict:
    db = get_firestore_client()
    pol_doc = db.collection("politicians").document(politician_id).get()
    if not pol_doc.exists:
        return {"success": False, "error": "Politician not found"}
    politician = {"id": politician_id, **pol_doc.to_dict()}
    last_sent = politician.get("lastAwarenessEmailSent")
    if last_sent:
        if (datetime.now(timezone.utc) - last_sent).total_seconds() < 48 * 3600:
            return {"success": False, "error": "Rate limit: email already sent within 48 hours"}
    issues_stream = db.collection("issues").where("constituencyId", "==", politician_id).where("status", "!=", "resolved").limit(5).stream()
    issues = []
    for issue in issues_stream:
        data = issue.to_dict()
        created = data.get("createdAt")
        days_pending = 0
        if created:
            days_pending = (datetime.now(timezone.utc) - created).days
        data["days_pending"] = days_pending
        issues.append(data)
    email_text = generate_politician_awareness_email(politician, issues)
    contact_email = politician.get("contactEmail")
    if not contact_email:
        return {"success": False, "error": "No contact email for politician"}
    sg = sendgrid.SendGridAPIClient(api_key=os.getenv("SENDGRID_API_KEY"))
    mail = Mail(
        from_email=Email(os.getenv("SENDGRID_FROM_EMAIL"), os.getenv("SENDGRID_FROM_NAME")),
        to_emails=To(contact_email),
        subject=f"[Community Hero] Unresolved Civic Issues in {politician.get('constituencyName', 'Your Constituency')}",
        plain_text_content=Content("text/plain", email_text)
    )
    try:
        sg.client.mail.send.post(request_body=mail.get())
        db.collection("politicians").document(politician_id).update({
            "lastAwarenessEmailSent": datetime.now(timezone.utc)
        })
        return {"success": True, "email_sent_to": contact_email}
    except Exception as e:
        return {"success": False, "error": str(e)}
