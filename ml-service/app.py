from fastapi import FastAPI

from clv import router as clv_router
from uplift import router as uplift_router

app = FastAPI(title="Aura Pricing ML Sidecar")
app.include_router(uplift_router)
app.include_router(clv_router)


@app.get("/health")
def health():
    return {"ok": True, "service": "pricing-ml-sidecar"}
