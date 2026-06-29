"""
Seed script to populate Firestore with 10 Lucknow constituency politicians.
Run: python seed_politicians.py
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from firebase_admin_config import get_firestore_client
from datetime import datetime, timezone
from services.predictions import run_prediction_pipeline

POLITICIANS = [
    {
        "id": "c1",
        "name": "Rajesh Patil",
        "party": "BJP",
        "constituencyId": "c1",
        "constituencyName": "Lucknow Central",
        "contactEmail": "test.dept1@gmail.com",
        "constituencyBounds": [
            {"lat": 26.865, "lng": 80.920},
            {"lat": 26.865, "lng": 80.960},
            {"lat": 26.825, "lng": 80.960},
            {"lat": 26.825, "lng": 80.920},
        ],
    },
    {
        "id": "c2",
        "name": "Priya Deshmukh",
        "party": "INC",
        "constituencyId": "c2",
        "constituencyName": "Lucknow West",
        "contactEmail": "test.dept2@gmail.com",
        "constituencyBounds": [
            {"lat": 26.885, "lng": 80.870},
            {"lat": 26.885, "lng": 80.910},
            {"lat": 26.845, "lng": 80.910},
            {"lat": 26.845, "lng": 80.870},
        ],
    },
    {
        "id": "c3",
        "name": "Suresh Jadhav",
        "party": "NCP",
        "constituencyId": "c3",
        "constituencyName": "Lucknow North",
        "contactEmail": "test.dept3@gmail.com",
        "constituencyBounds": [
            {"lat": 26.915, "lng": 80.920},
            {"lat": 26.915, "lng": 80.960},
            {"lat": 26.875, "lng": 80.960},
            {"lat": 26.875, "lng": 80.920},
        ],
    },
    {
        "id": "c4",
        "name": "Anil Sharma",
        "party": "BJP",
        "constituencyId": "c4",
        "constituencyName": "Lucknow East",
        "contactEmail": "test.dept4@gmail.com",
        "constituencyBounds": [
            {"lat": 26.890, "lng": 80.960},
            {"lat": 26.890, "lng": 81.000},
            {"lat": 26.850, "lng": 81.000},
            {"lat": 26.850, "lng": 80.960},
        ],
    },
    {
        "id": "c5",
        "name": "Meera Kulkarni",
        "party": "SS",
        "constituencyId": "c5",
        "constituencyName": "Lucknow Cantonment",
        "contactEmail": "test.dept5@gmail.com",
        "constituencyBounds": [
            {"lat": 26.830, "lng": 80.930},
            {"lat": 26.830, "lng": 80.970},
            {"lat": 26.790, "lng": 80.970},
            {"lat": 26.790, "lng": 80.930},
        ],
    },
    {
        "id": "c6",
        "name": "Vikram Bhosale",
        "party": "NCP",
        "constituencyId": "c6",
        "constituencyName": "Sarojini Nagar",
        "contactEmail": "test.dept6@gmail.com",
        "constituencyBounds": [
            {"lat": 26.790, "lng": 80.850},
            {"lat": 26.790, "lng": 80.910},
            {"lat": 26.730, "lng": 80.910},
            {"lat": 26.730, "lng": 80.850},
        ],
    },
    {
        "id": "c7",
        "name": "Sunita Pawar",
        "party": "INC",
        "constituencyId": "c7",
        "constituencyName": "Bakshi Ka Talab",
        "contactEmail": "test.dept7@gmail.com",
        "constituencyBounds": [
            {"lat": 27.020, "lng": 80.900},
            {"lat": 27.020, "lng": 80.960},
            {"lat": 26.940, "lng": 80.960},
            {"lat": 26.940, "lng": 80.900},
        ],
    },
    {
        "id": "c8",
        "name": "Deepak Mane",
        "party": "BJP",
        "constituencyId": "c8",
        "constituencyName": "Mohanlalganj",
        "contactEmail": "test.dept8@gmail.com",
        "constituencyBounds": [
            {"lat": 26.720, "lng": 80.940},
            {"lat": 26.720, "lng": 81.000},
            {"lat": 26.640, "lng": 81.000},
            {"lat": 26.640, "lng": 80.940},
        ],
    },
    {
        "id": "c9",
        "name": "Anita More",
        "party": "SS",
        "constituencyId": "c9",
        "constituencyName": "Hazratganj",
        "contactEmail": "test.dept9@gmail.com",
        "constituencyBounds": [
            {"lat": 26.865, "lng": 80.935},
            {"lat": 26.865, "lng": 80.965},
            {"lat": 26.835, "lng": 80.965},
            {"lat": 26.835, "lng": 80.935},
        ],
    },
    {
        "id": "c10",
        "name": "Ramesh Shinde",
        "party": "BJP",
        "constituencyId": "c10",
        "constituencyName": "Gomti Nagar",
        "contactEmail": "test.dept10@gmail.com",
        "constituencyBounds": [
            {"lat": 26.880, "lng": 80.980},
            {"lat": 26.880, "lng": 81.020},
            {"lat": 26.840, "lng": 81.020},
            {"lat": 26.840, "lng": 80.980},
        ],
    },
]


def seed():
    db = get_firestore_client()
    for pol in POLITICIANS:
        doc_data = {
            **pol,
            "shameScore": 0.0,
            "totalIssues": 0,
            "resolvedIssues": 0,
            "unresolvedIssues": 0,
            "avgResolutionDays": 0.0,
            "updatedAt": datetime.now(timezone.utc),
        }
        db.collection("politicians").document(pol["id"]).set(doc_data)
        print(f"  [+] Seeded politician: {pol['name']} ({pol['constituencyName']})")
    print(f"\n[Success] Seeded {len(POLITICIANS)} politicians successfully.")
    
    print("\nRunning initial prediction pipeline to generate hotspots...")
    try:
        preds = run_prediction_pipeline()
        print(f"[Success] Generated {len(preds)} risk hotspots across wards.")
    except Exception as e:
        print(f"[Error] Failed to run prediction pipeline: {str(e)}")


if __name__ == "__main__":
    print("Seeding Lucknow constituency politicians into Firestore...")
    seed()
