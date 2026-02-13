from fastapi import FastAPI, Body
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os
import uvicorn
import json
import sys
from pathlib import Path
from loguru import logger
from src.python.quantum_engine import engine

# Configure Loguru
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
)

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    logger.info("Quantum Sound Server Starting...")
    logger.info(f"Calibration Directory: {CALIBRATION_DIR.absolute()}")


# Ensure calibration directory exists
CALIBRATION_DIR = Path("data/calibrations")
CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)

# Map circuit names to engine methods
CIRCUIT_MAP = {
    "phaser_evolution": engine.get_phase_evolution,
    "random_rotation": engine.get_random_rotation,
    "quantum_chaos": engine.get_quantum_chaos,
}


@app.middleware("http")
async def add_logging_middleware(request, call_next):
    logger.info(f"Incoming Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response Status: {response.status_code}")
    if request.url.path.startswith(("/src", "/assets", "/circuits")):
        response.headers["Cache-Control"] = "public, max-age=3600"
    return response


@app.get("/api/circuit")
async def get_circuit(circuit: str = "bell_state"):
    if circuit in CIRCUIT_MAP:
        logger.debug(f"Generating circuit: {circuit}")
        result = CIRCUIT_MAP[circuit]()
        return JSONResponse(content=result)
    logger.warning(f"Circuit not found: {circuit}")
    return JSONResponse(content={"error": "Circuit not found"}, status_code=404)


@app.get("/api/audio-manifest")
async def get_audio_manifest():
    audio_dir = "assets/audio/loops"
    manifest = {}

    if os.path.exists(audio_dir):
        for category in os.listdir(audio_dir):
            cat_path = os.path.join(audio_dir, category)
            if os.path.isdir(cat_path):
                # Filter for .wav files and exclude hidden files/dirs
                tracks = [
                    f
                    for f in os.listdir(cat_path)
                    if f.endswith(".wav") and not f.startswith(".")
                ]
                if tracks:
                    manifest[category] = sorted(tracks)

    logger.info(f"Audio Manifest Loaded: {len(manifest)} categories found")
    return JSONResponse(content=manifest)


@app.post("/api/calibration/save")
async def save_calibration(data: dict = Body(...)):
    name = data.get("name")
    mask = data.get("mask")
    if not name or mask is None:
        logger.error("Save Calibration Failed: Missing name or mask")
        return JSONResponse(content={"error": "Missing name or mask"}, status_code=400)

    # Sanitize name to avoid path traversal
    safe_name = "".join([c for c in name if c.isalnum() or c in ("-", "_")]).strip()
    if not safe_name:
        logger.error(f"Save Calibration Failed: Invalid name '{name}'")
        return JSONResponse(content={"error": "Invalid name"}, status_code=400)

    file_path = CALIBRATION_DIR / f"{safe_name}.json"
    with open(file_path, "w") as f:
        json.dump({"name": name, "mask": mask}, f)

    logger.success(f"Calibration Saved: {safe_name}")
    return JSONResponse(content={"status": "saved", "file": safe_name})


@app.get("/api/calibration/list")
async def list_calibrations():
    files = [f.stem for f in CALIBRATION_DIR.glob("*.json")]
    logger.info(f"Listing Calibrations: {len(files)} found")
    return JSONResponse(content=files)


@app.get("/api/calibration/get/{name}")
async def get_calibration(name: str):
    file_path = CALIBRATION_DIR / f"{name}.json"
    if file_path.exists():
        with open(file_path, "r") as f:
            data = json.load(f)
            logger.info(f"Calibration Loaded: {name}")
            return JSONResponse(content=data)
    logger.warning(f"Calibration Not Found: {name}")
    return JSONResponse(content={"error": "Calibration not found"}, status_code=404)


@app.get("/circuits/{circuit_name}_diagram.png")
async def get_circuit_diagram(circuit_name: str):
    diagram_path = f"circuits/{circuit_name}_diagram.png"
    if not os.path.exists(diagram_path):
        import subprocess

        # Generate all diagrams if missing
        logger.info(f"Generating diagram for {circuit_name}...")
        subprocess.run([sys.executable, "circuits/plot_circuit.py"])

    if os.path.exists(diagram_path):
        return FileResponse(diagram_path)
    logger.error(f"Diagram generation failed for {circuit_name}")
    return JSONResponse(content={"error": "Diagram not found"}, status_code=404)


@app.get("/circuits/circuit_diagram.png")
async def get_legacy_circuit_diagram():
    diagram_path = "circuits/circuit_diagram.png"
    if os.path.exists(diagram_path):
        return FileResponse(diagram_path)
    return JSONResponse(content={"error": "Diagram not found"}, status_code=404)


# Serve static files last
app.mount("/src", StaticFiles(directory="src"), name="src")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/circuits", StaticFiles(directory="circuits"), name="circuits")


@app.get("/")
async def read_index():
    logger.info("Serving Index")
    return FileResponse("index.html")


@app.get("/{path:path}")
async def catch_all(path: str):
    if os.path.exists(path):
        return FileResponse(path)
    logger.warning(f"404 Not Found: {path}")
    return FileResponse("index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8050)
