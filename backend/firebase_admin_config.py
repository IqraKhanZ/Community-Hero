import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
import os
from dotenv import load_dotenv

load_dotenv()

_app = None

def get_firebase_app():
    global _app
    if _app is None:
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
        else:
            # Use application default credentials (for Cloud Run)
            cred = credentials.ApplicationDefault()
        _app = firebase_admin.initialize_app(cred)
    return _app

def get_firestore_client():
    get_firebase_app()
    return firestore.client()

def verify_id_token(token: str):
    get_firebase_app()
    return firebase_auth.verify_id_token(token)
