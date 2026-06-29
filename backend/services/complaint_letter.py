import os
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content
from firebase_admin_config import get_firestore_client
from services.gemini_service import generate_complaint_letter
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

def send_complaint_email(issue: dict, reporter_email: str = None) -> dict:
    """Generate and send complaint letter via SendGrid."""
    letter_text = generate_complaint_letter(issue)
    department_email = issue.get("departmentEmail", os.getenv("SENDGRID_FROM_EMAIL"))
    issue_id = issue.get("id", "N/A")
    category = issue.get("category", "Civic Issue")
    address = issue.get("location", {}).get("address", "Unknown Location")
    subject = f"[CIVIC COMPLAINT - REF: {issue_id}] {category} reported at {address}"
    sg = sendgrid.SendGridAPIClient(api_key=os.getenv("SENDGRID_API_KEY"))
    from_email = Email(os.getenv("SENDGRID_FROM_EMAIL", "noreply@communityhero.app"), os.getenv("SENDGRID_FROM_NAME", "Community Hero"))
    to_email = To(department_email)
    content = Content("text/plain", letter_text)
    mail = Mail(from_email, to_email, subject, content)
    if reporter_email:
        mail.add_cc(Email(reporter_email))
    delivery_status = "sent"
    try:
        response = sg.client.mail.send.post(request_body=mail.get())
        delivery_status = "sent" if response.status_code in [200, 201, 202] else "failed"
    except Exception as e:
        delivery_status = f"failed: {str(e)}"
    db = get_firestore_client()
    letter_doc = {
        "issueId": issue_id,
        "department": issue.get("department", "Unknown"),
        "recipientEmail": department_email,
        "letterText": letter_text,
        "sentAt": datetime.now(timezone.utc),
        "deliveryStatus": delivery_status
    }
    letter_ref = db.collection("complaintLetters").add(letter_doc)
    update_data = {
        "complaintLetterSent": True,
        "complaintLetterSentAt": datetime.now(timezone.utc),
        "complaintLetterText": letter_text,
        "updatedAt": datetime.now(timezone.utc)
    }
    db.collection("issues").document(issue_id).update(update_data)
    notification = {
        "userId": issue.get("reportedBy", ""),
        "type": "complaint_letter_sent",
        "issueId": issue_id,
        "message": f"An official complaint letter has been emailed to {issue.get('department', 'the department')} on your behalf",
        "read": False,
        "createdAt": datetime.now(timezone.utc)
    }
    db.collection("notifications").add(notification)
    return {
        "success": delivery_status == "sent",
        "letter_text": letter_text,
        "delivery_status": delivery_status,
        "recipient": department_email
    }

def send_fraud_alert_email(issue: dict) -> dict:
    """Send fraud alert email to department."""
    issue_copy = issue.copy()
    issue_copy["description"] = f"[FRAUD ALERT] Fake repair photo detected. Original issue: {issue.get('description', '')}"
    address = issue.get("location", {}).get("address", "Unknown Location")
    issue_copy["_override_subject"] = f"[FRAUD ALERT] Fake repair reported at {address}"
    return send_complaint_email(issue_copy)
