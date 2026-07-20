from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class ExperimentRow(BaseModel):
    clientId: int
    assignment: Literal["treatment", "holdout"]
    booked: int | None = None
    revenuePaise: int = 0
    features: dict[str, Any] = Field(default_factory=dict)


class ClientRow(BaseModel):
    clientId: int
    features: dict[str, Any] = Field(default_factory=dict)


class UpliftRequest(BaseModel):
    experiments: list[ExperimentRow] = Field(default_factory=list)
    clients: list[ClientRow] = Field(default_factory=list)


def _resolved(rows: list[ExperimentRow], assignment: str) -> list[ExperimentRow]:
    return [row for row in rows if row.assignment == assignment and row.booked is not None]


def _booking_rate(rows: list[ExperimentRow]) -> float:
    if not rows:
        return 0.0
    return sum(1 for row in rows if row.booked == 1) / len(rows)


def _segment(uplift: float, treatment_rate: float, holdout_rate: float) -> str:
    if uplift >= 0.08:
        return "persuadable"
    if treatment_rate >= 0.35 and holdout_rate >= 0.35:
        return "sure_thing"
    if uplift < -0.03:
        return "sleeping_dog"
    return "lost_cause"


@router.post("/causal/uplift")
def compute_uplift(req: UpliftRequest):
    treatment = _resolved(req.experiments, "treatment")
    holdout = _resolved(req.experiments, "holdout")
    treatment_rate = _booking_rate(treatment)
    holdout_rate = _booking_rate(holdout)
    aggregate_uplift = treatment_rate - holdout_rate
    ready = len(treatment) >= 50 and len(holdout) >= 10

    if not ready:
        return {
            "ready": False,
            "reason": "Need at least 50 treatment and 10 holdout resolved outcomes before uplift scoring.",
            "treatmentResolved": len(treatment),
            "holdoutResolved": len(holdout),
            "treatmentBookingRate": round(treatment_rate, 4),
            "holdoutBookingRate": round(holdout_rate, 4),
            "aggregateUplift": round(aggregate_uplift, 4),
            "scores": [],
        }

    segment = _segment(aggregate_uplift, treatment_rate, holdout_rate)
    score = max(0.0, min(1.0, aggregate_uplift))
    scores = [
        {
            "clientId": client.clientId,
            "upliftScore": round(score, 4),
            "segment": segment,
            "method": "aggregate_holdout_baseline",
            "reasoning": "Client-level model features were not trained here; score uses branch-level treatment vs holdout lift.",
        }
        for client in req.clients
    ]

    return {
        "ready": True,
        "treatmentResolved": len(treatment),
        "holdoutResolved": len(holdout),
        "treatmentBookingRate": round(treatment_rate, 4),
        "holdoutBookingRate": round(holdout_rate, 4),
        "aggregateUplift": round(aggregate_uplift, 4),
        "scores": scores,
    }
