from math import exp
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/clv", tags=["clv"])


class Transaction(BaseModel):
    amountPaise: int = Field(default=0, ge=0)
    daysAgo: int = Field(default=0, ge=0)


class ClvPredictRequest(BaseModel):
    clientId: int
    transactions: List[Transaction] = Field(default_factory=list)
    lastVisitDaysAgo: Optional[int] = Field(default=None, ge=0)


def stage_from(frequency: int, churn_risk: float) -> str:
    if frequency <= 1:
        return "new"
    if churn_risk >= 0.65:
        return "at_risk"
    if frequency >= 8 and churn_risk < 0.25:
        return "mature"
    if churn_risk >= 0.45:
        return "declining"
    return "growing"


@router.post("/predict")
def predict_clv(req: ClvPredictRequest):
    total = sum(tx.amountPaise for tx in req.transactions)
    frequency = len(req.transactions)
    avg_ticket = total // frequency if frequency else 0
    recency = req.lastVisitDaysAgo
    if recency is None and req.transactions:
        recency = min(tx.daysAgo for tx in req.transactions)
    recency = recency if recency is not None else 365

    churn_risk = max(0.0, min(1.0, 1 - exp(-recency / 180)))
    predicted_visits = max(1, round((frequency / 12) * 24)) if frequency else 1
    predicted_clv = max(total, predicted_visits * avg_ticket)
    stage = stage_from(frequency, churn_risk)
    budget = round(predicted_clv * (0.04 if stage in {"new", "at_risk"} else 0.015))

    return {
        "clientId": req.clientId,
        "predictedClvPaise": int(predicted_clv),
        "currentValuePaise": int(total),
        "churnRisk": round(churn_risk, 4),
        "acquisitionStage": stage,
        "recommendedDiscountBudgetPaise": int(budget),
        "modelVersion": "rfm_baseline_v1",
        "note": "Stateless sidecar output only. Aura backend owns all DB writes."
    }
