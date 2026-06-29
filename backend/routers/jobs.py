from fastapi import APIRouter, Header, HTTPException, Depends
import os
from services.predictions import run_prediction_pipeline
from services.politician_service import recalculate_shame_score
from firebase_admin_config import get_firestore_client
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()


def verify_job_token(x_job_secret: str = Header(None)):
    expected = os.getenv("JOB_SECRET_TOKEN", "")
    if not expected or x_job_secret != expected:
        raise HTTPException(status_code=403, detail="Invalid job secret token")
    return True


@router.post("/jobs/run-predictions")
async def run_predictions(authorized: bool = Depends(verify_job_token)):
    results = run_prediction_pipeline()
    return {"success": True, "predictions_created": len(results)}


@router.post("/jobs/recalculate-shame-scores")
async def recalculate_all_shame_scores(authorized: bool = Depends(verify_job_token)):
    db = get_firestore_client()
    politicians = db.collection("politicians").stream()
    results = []
    for pol in politicians:
        data = pol.to_dict()
        constituency_id = data.get("constituencyId")
        if constituency_id:
            metrics = recalculate_shame_score(constituency_id)
            results.append({"id": pol.id, **metrics})
    return {"success": True, "updated": len(results), "results": results}
