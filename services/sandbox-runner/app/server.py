from fastapi import FastAPI
from rio_core.sandbox import SandboxInput, SandboxOutput

from app.orchestrator import orchestrate

app = FastAPI()

@app.get("/v1/health")
def health() -> dict:
    return {"status" : "ok"}

@app.post("/v1/verify")
def verify_endpoint(data : SandboxInput) -> SandboxOutput:
    return orchestrate(data)