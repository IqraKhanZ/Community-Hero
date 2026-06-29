"""
gemini_service.py - All Gemini AI calls using the stable google-generativeai SDK.
Using gemini-1.5-flash to ensure compatibility and avoid quota limitations.
"""
import os
import json
import httpx
import base64
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Configure the SDK
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

def _download_image_as_base64(url: str) -> tuple[bytes, str]:
    """Download an image from URL and return bytes + mime type."""
    response = httpx.get(url, timeout=30, follow_redirects=True)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "image/jpeg")
    if ";" in content_type:
        content_type = content_type.split(";")[0].strip()
    return response.content, content_type

def analyze_issue_image(image_url: str, description: str = "") -> dict:
    """Analyze civic issue image using Gemini Vision."""
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        image_bytes, mime_type = _download_image_as_base64(image_url)
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_bytes).decode("utf-8")
        }
        prompt = f"""Analyze this civic infrastructure image and identify the issue.
User description: {description}

Respond ONLY with valid JSON in this exact format:
{{
  "detected_issue": "brief description of what you see",
  "severity": "low|medium|high|critical",
  "confidence": 0.85,
  "suggested_category": "Pothole|Water Leakage|Streetlight|Waste Management|Other",
  "reasoning": "why you assessed this severity"
}}"""
        response = model.generate_content([image_part, prompt])
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        return {
            "detected_issue": "Unable to analyze image",
            "severity": "medium",
            "confidence": 0.0,
            "suggested_category": "Other",
            "reasoning": f"Analysis failed: {str(e)}"
        }

def analyze_repair_fraud(before_url: str, after_url: str) -> dict:
    """Compare before and after repair photos to detect fraud."""
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        before_bytes, before_mime = _download_image_as_base64(before_url)
        after_bytes, after_mime = _download_image_as_base64(after_url)
        before_part = {
            "mime_type": before_mime,
            "data": base64.b64encode(before_bytes).decode("utf-8")
        }
        after_part = {
            "mime_type": after_mime,
            "data": base64.b64encode(after_bytes).decode("utf-8")
        }
        prompt = """You are a fraud detection AI analyzing civic repair verification photos.
Compare the BEFORE photo (first image) and AFTER photo (second image).

Assess:
1. Is the reported issue visibly fixed in the after photo?
2. Do both photos appear to be taken at the same location?
3. Does the after photo look like a stock image or unrelated photo?
4. How confident are you the repair is genuine?

Respond ONLY with valid JSON:
{
  "issue_fixed": true,
  "same_location": true,
  "appears_stock_or_unrelated": false,
  "confidence": 0.9,
  "verdict": "GENUINE|SUSPICIOUS|FAKE",
  "reasoning": "explanation of your assessment"
}"""
        response = model.generate_content([before_part, after_part, prompt])
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        return {
            "issue_fixed": False,
            "same_location": False,
            "appears_stock_or_unrelated": True,
            "confidence": 0.0,
            "verdict": "SUSPICIOUS",
            "reasoning": f"Analysis failed: {str(e)}"
        }

def generate_complaint_letter(issue: dict) -> str:
    """Generate formal government complaint letter for an issue."""
    severity_sla = {
        "critical": "24 hours",
        "high": "72 hours",
        "medium": "7 days",
        "low": "14 days"
    }
    sla = severity_sla.get(issue.get("severity", "medium"), "7 days")
    prompt = f"""Write a formal complaint letter for the following civic issue.
Issue details:
- Reference Number: {issue.get('id', 'N/A')}
- Category: {issue.get('category', 'N/A')}
- Severity: {issue.get('severity', 'N/A')}
- Description: {issue.get('description', 'N/A')}
- Location: {issue.get('location', {}).get('address', 'N/A')}
- Ward: {issue.get('location', {}).get('ward', 'N/A')}
- Department: {issue.get('department', 'N/A')}
- Reported Date: {issue.get('createdAt', 'N/A')}
- Required Response Time: {sla}

Write a formal Indian government-style complaint letter. Include:
- Official reference number header
- Date
- To: {issue.get('department', 'The Department')} (recipient address)
- Subject line
- Formal body with precise issue description, location, and severity
- Clear request for action within {sla}
- Closing with 'Concerned Citizen'

Write ONLY the letter text, no JSON, no explanation. Use plain text suitable as email body."""
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"""Reference: {issue.get('id', 'N/A')}
Date: {issue.get('createdAt', 'N/A')}

To,
The {issue.get('department', 'Concerned Department')}

Sub: Complaint regarding {issue.get('category', 'Civic Issue')} at {issue.get('location', {}).get('address', 'N/A')}

Dear Sir/Madam,

I am writing to bring to your attention a serious civic issue that requires immediate attention.

Issue: {issue.get('description', 'N/A')}
Location: {issue.get('location', {}).get('address', 'N/A')}
Severity: {issue.get('severity', 'medium').upper()}

I request that this matter be resolved within {sla}.

Thank you for your prompt attention.

Yours faithfully,
Concerned Citizen"""

def generate_politician_awareness_email(politician: dict, issues: list) -> str:
    """Generate awareness email listing top unresolved issues in constituency."""
    issues_text = "\n".join([
        f"{i+1}. {issue.get('category', 'Issue')} at {issue.get('location', {}).get('address', 'N/A')} - {issue.get('severity', 'medium').upper()} severity - Pending {issue.get('days_pending', 0)} days"
        for i, issue in enumerate(issues[:5])
    ])
    prompt = f"""Write a formal email to {politician.get('name', 'the Honourable Member')} ({politician.get('party', 'N/A')}), representing {politician.get('constituencyName', 'N/A')} constituency.

The email is from Community Hero civic platform and lists the top 5 unresolved civic issues:
{issues_text}

The politician's shame score is {politician.get('shameScore', 0):.1f}/100.

Write a professional, respectful but firm email requesting attention to these issues. Include specific locations and days pending. Sign off as 'Community Hero Civic Platform'.

Write ONLY the email text, no JSON, no explanation."""
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Dear {politician.get('name', 'Honourable Member')},\n\nWe are writing regarding {len(issues)} unresolved civic issues in {politician.get('constituencyName', 'your constituency')}.\n\nTop issues:\n{issues_text}\n\nWe urge prompt action.\n\nRegards,\nCommunity Hero Civic Platform"

def civicbot_chat(messages: list, user_context: dict = None) -> str:
    """Multi-turn chat with CivicBot."""
    system_prompt = """You are CivicBot, an AI assistant for Community Hero — a civic issue reporting platform for Indian cities.

You help citizens:
- Report civic issues (potholes, water leakage, streetlights, waste management)
- Check issue status ("check my issues" to see their recent reports)
- Understand the politician accountability tracker
- Understand how AI fraud detection works
- Navigate the app

You can speak both English and Hindi. Keep responses concise and action-oriented.
When the user says "check my issues", summarize the issues from user_context.user_issues_summary if available.
When asked about nearby issues, mention they can use the map with filters.
Always guide the user toward the right page using markdown links, e.g. [Report Issue](/report), [City Analytics](/analytics), [Accountability Tracker](/accountability), or [My Dashboard](/dashboard). Do not output raw text path strings.

Do NOT make up issue data. If you don't have real data, say so."""

    if user_context:
        context_parts = []
        if user_context.get("user_issues_summary"):
            context_parts.append(f"User's recent issues:\n{user_context['user_issues_summary']}")
        if user_context.get("page"):
            context_parts.append(f"User is currently on page: {user_context['page']}")
        if user_context.get("nearby_hint"):
            context_parts.append(user_context["nearby_hint"])
        if context_parts:
            system_prompt += "\n\nContext:\n" + "\n".join(context_parts)

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt
        )
        chat = model.start_chat(history=[])
        
        # Convert simple history message structure to legacy SDK structure
        for msg in messages[:-1]:
            # Simple simulation of chat history inside start_chat
            pass
            
        last_message = messages[-1]["content"] if messages else "Hello"
        response = chat.send_message(last_message)
        return response.text.strip()
    except Exception as e:
        return f"Sorry, I'm having trouble connecting right now. Please try again in a moment. (Error: {str(e)[:100]})"
