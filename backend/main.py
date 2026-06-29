from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import issues, agent, politicians, notifications, jobs, fraud
import uvicorn

app = FastAPI(
    title="Community Hero API",
    description="AI-powered civic issue reporting platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(issues.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(politicians.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(fraud.router, prefix="/api")

@app.get("/")
def root():
    return {"status": "Community Hero API is running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
