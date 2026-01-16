from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os
import uvicorn
from src.python.quantum_engine import engine

app = FastAPI()

# Map circuit names to engine methods
CIRCUIT_MAP = {
    "bell_state": engine.get_bell_state,
    "phase_evolution": engine.get_phase_evolution,
    "random_rotation": engine.get_random_rotation,
}


@app.get("/api/circuit")
async def get_circuit(circuit: str = "bell_state"):
    if circuit in CIRCUIT_MAP:
        result = CIRCUIT_MAP[circuit]()
        return JSONResponse(content=result)
    return JSONResponse(content={"error": "Circuit not found"}, status_code=404)


@app.get("/circuits/circuit_diagram.png")
async def get_circuit_diagram():
    diagram_path = "circuits/circuit_diagram.png"
    if not os.path.exists(diagram_path):
        import subprocess

        # Generate it once if missing
        subprocess.run(["python3", "circuits/plot_circuit.py"])

    if os.path.exists(diagram_path):
        return FileResponse(diagram_path)
    return JSONResponse(content={"error": "Diagram not found"}, status_code=404)


# Serve static files last
app.mount("/src", StaticFiles(directory="src"), name="src")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/circuits", StaticFiles(directory="circuits"), name="circuits")


@app.get("/")
async def read_index():
    return FileResponse("index.html")


@app.get("/{path:path}")
async def catch_all(path: str):
    if os.path.exists(path):
        return FileResponse(path)
    return FileResponse("index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
