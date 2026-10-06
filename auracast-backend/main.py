from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
import httpx


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Auracast API is running"}


# Pydantic Schemas for type safety and OpenAPI docs
class Location(BaseModel):
    latitude: float
    longitude: float

class TimelineItem(BaseModel):
    time: str
    pressure_hpa: float
    delta_3h: float
    drop_hpa: float
    risk_level: str

class RiskResponse(BaseModel):
    location: Location
    user_sensitivity: float
    total_warnings: int
    timeline: List[TimelineItem]

async def analyse_pressure_risk(lat: float, lon: float, user_sensitivity: float = 2.5) -> List[dict]:
    # Ensure sensitivity is treated as a positive magnitude for cleaner logic
    sensitivity_threshold = abs(user_sensitivity)

    # Limit forecast_days=2 (48 hours)
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=pressure_msl&timezone=auto&forecast_days=2&past_days=1"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as e:
            raise HTTPException(status_code=503, detail=f"Error fetching weather data: {str(e)}")

    if "hourly" not in data or "pressure_msl" not in data["hourly"]:
        raise HTTPException(status_code=502, detail="Unexpected data format from weather API")

    times = data["hourly"]["time"]
    pressures = data["hourly"]["pressure_msl"]

    risk_windows = []   

    # Define how many hours back to analyze for cumulative pressure changes
    Lookback_hours = 24

    if len(pressures) <= Lookback_hours:
        raise HTTPException(status_code=500, detail="Insufficient pressure data for analysis")

    for i in range(Lookback_hours, len(pressures)):

        delta = round(pressures[i] - pressures[i - 3], 2)

        pressure_drop_magnnitude = abs(delta) if delta < 0 else 0.0
    
        # Evaluate risk tiers
        if pressure_drop_magnnitude >= sensitivity_threshold:
            risk_level = "High"
        elif pressure_drop_magnnitude >= max(0.5, sensitivity_threshold - 1.0):
            risk_level = "Medium"
        else:
            risk_level = "Low"

        risk_windows.append(
            {
                "time": times[i],
                "pressure_hpa": pressures[i],
                "delta_3h": delta,
                "drop_hpa": pressure_drop_magnnitude,
                "risk_level": risk_level
            }
        )
    return risk_windows

#define web api endpoint
@app.get("/api/risk", response_model=RiskResponse)
async def get_headache_risk(
    lat: float = Query(45.4215, description="Latitude"),
    lon: float = Query(-75.6972,description="Longitude"),
    sensitivity: float = Query(2.5, description="User sensitivity")):
    hours_data = await analyse_pressure_risk(lat, lon, sensitivity)

    alerts = [h for h in hours_data if h["risk_level"] in ["Medium", "High"]]

    return {
        "location": {"latitude": lat, "longitude": lon},
        "user_sensitivity": sensitivity,
        "total_warnings": len(alerts),
        "timeline": hours_data
    }