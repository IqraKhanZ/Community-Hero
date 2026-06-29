import os
import requests
from firebase_admin_config import get_firestore_client
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import math

load_dotenv()

ROAD_AGE_DATA = {
    "ward_1": {"name": "Lucknow Central", "age_years": 7},
    "ward_2": {"name": "Lucknow West", "age_years": 4},
    "ward_3": {"name": "Lucknow North", "age_years": 8},
    "ward_4": {"name": "Lucknow East", "age_years": 3},
    "ward_5": {"name": "Lucknow Cantonment", "age_years": 2},
    "ward_6": {"name": "Sarojini Nagar", "age_years": 5},
    "ward_7": {"name": "Bakshi Ka Talab", "age_years": 1},
    "ward_8": {"name": "Mohanlalganj", "age_years": 6},
    "ward_9": {"name": "Hazratganj", "age_years": 4},
    "ward_10": {"name": "Gomti Nagar", "age_years": 9},
}

def get_road_age_multiplier(ward_id: str) -> float:
    age = ROAD_AGE_DATA.get(ward_id, {}).get("age_years", 3)
    if age <= 2:
        return 1.0
    elif age <= 5:
        return 1.3
    else:
        return 1.6

def analyze_historical_patterns(ward_id: str) -> dict:
    db = get_firestore_client()
    issues = db.collection("issues").where("location.ward", "==", ward_id).where("status", "==", "resolved").stream()
    category_counts = {}
    category_months = {}
    for issue in issues:
        data = issue.to_dict()
        cat = data.get("category", "Other")
        created_at = data.get("createdAt")
        if cat not in category_counts:
            category_counts[cat] = 0
            category_months[cat] = {}
        category_counts[cat] += 1
        if created_at:
            month = created_at.month if hasattr(created_at, 'month') else 1
            category_months[cat][month] = category_months[cat].get(month, 0) + 1
    total = sum(category_counts.values()) or 1
    risk_scores = {}
    for cat, count in category_counts.items():
        risk_scores[cat] = min(count / total, 1.0)
    return risk_scores

def get_weather_factor() -> dict:
    api_key = os.getenv("OPENWEATHER_API_KEY")
    lat = os.getenv("CITY_LAT", "18.5204")
    lon = os.getenv("CITY_LON", "73.8567")
    weather_factors = {
        "Pothole": 0.0,
        "Water Leakage": 0.0,
        "Streetlight": 0.0,
        "Waste Management": 0.0,
        "Other": 0.0
    }
    if not api_key or api_key == "YOUR_OPENWEATHER_API_KEY":
        return weather_factors
    try:
        url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        response = requests.get(url, timeout=10)
        data = response.json()
        forecasts = data.get("list", [])
        heavy_rain = False
        storm = False
        dry_spell = True
        for item in forecasts[:56]:
            weather_id = item.get("weather", [{}])[0].get("id", 0)
            rain = item.get("rain", {}).get("3h", 0)
            if rain > 10:
                heavy_rain = True
                dry_spell = False
            if weather_id in range(200, 300) or weather_id in range(900, 910):
                storm = True
        if heavy_rain:
            weather_factors["Pothole"] += 0.3
            weather_factors["Water Leakage"] += 0.3
        if dry_spell:
            weather_factors["Waste Management"] += 0.2
        if storm:
            weather_factors["Streetlight"] += 0.25
    except Exception:
        pass
    return weather_factors

def run_prediction_pipeline():
    db = get_firestore_client()
    weather_factors = get_weather_factor()
    results = []
    for ward_id, ward_data in ROAD_AGE_DATA.items():
        historical_scores = analyze_historical_patterns(ward_id)
        road_multiplier = get_road_age_multiplier(ward_id)
        for category in ["Pothole", "Water Leakage", "Streetlight", "Waste Management"]:
            historical_score = historical_scores.get(category, 0.7)
            weather_factor = weather_factors.get(category, 0.0)
            combined_score = (historical_score * 0.6) + (weather_factor * 0.4)
            final_score = min(combined_score * road_multiplier, 1.0)
            if final_score >= 0.65:
                timeframe = "7 days" if final_score >= 0.8 else "30 days"
                ward_name = ward_data["name"]
                prediction_doc = {
                    "location": {
                        "lat": float(os.getenv("CITY_LAT", "18.5204")) + (hash(ward_id) % 100) * 0.001,
                        "lng": float(os.getenv("CITY_LON", "73.8567")) + (hash(ward_id + category) % 100) * 0.001,
                        "address": ward_name,
                        "ward": ward_id
                    },
                    "predictedCategory": category,
                    "riskScore": round(final_score, 3),
                    "predictedDate": datetime.now(timezone.utc) + timedelta(days=7 if final_score >= 0.8 else 30),
                    "factors": {
                        "weatherFactor": round(weather_factor, 3),
                        "historicalCount": historical_scores.get(category, 0),
                        "roadAgeFactor": road_multiplier
                    },
                    "timeframe": timeframe,
                    "wardName": ward_name,
                    "createdAt": datetime.now(timezone.utc)
                }
                db.collection("predictions").add(prediction_doc)
                results.append(prediction_doc)
    return results
