import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)

test_models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite"
]

for model_name in test_models:
    print(f"\nTesting model: {model_name}...")
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Hello! What is your name?")
        print(f" -> SUCCESS: {response.text.strip()}")
    except Exception as e:
        print(f" -> FAILED: {str(e)[:250]}")
