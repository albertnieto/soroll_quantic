# Lluc Llum - Quantum Visualization & Laboratory

A multi-layered quantum qubit visualization and algorithmic laboratory. This project combines PennyLane's quantum simulation with high-performance WebGL shaders to create a premium, interactive experience of quantum physics.

## 🌟 Features

- **Core Quantum Engine**: 4-qubit system with real-time probability evolution and entanglement visualization.
- **Microphone Interaction**: Use 4-channel audio input to trigger qubit decoherence (collapse) and ripple effects.
- **Advanced Shaders**: 
  - **Black Hole**: Gravitational lensing, Einstein rings, and accretion discs driven by quantum state.
  - **Quantum Clouds**: Multi-particle point systems visualizing wave function density.
  - **Mic Ripples**: Real-time energy propagation through the quantum field.
- **PennyLane Integration**: Real-world quantum algorithms (Bell State, Phase Evolution, Quantum Chaos) executed gate-by-gate.
- **Laboratory Experiments**: Separate tools for 3D STL exporting, studio viewing, and scroll-based interactive storytelling.

## 🚀 Getting Started

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Launch the Application
Use the robust start script (recommended):
```bash
./start.sh
```
Or run the dev mode:
```bash
./start.sh --dev
```

Then open **[http://localhost:8050](http://localhost:8050)** in your browser.

## 🔬 The Laboratory (`/labs`)

This repository includes several experimental components located in the `/labs` directory:

- **[Ripple Studio](/labs/ripple_studio.html)**: Design and export custom 3D ripple geometries as STL files for 3D printing.
- **[Open Studio](/labs/open_studio.html)**: A premium holographic workspace for inspecting STL models.
- **[Quantum Scroll](/labs/quantum_scroll.html)**: An interactive portfolio demonstration showing smooth sphere settling and UI transitions.
- **[Quantum Scene](/labs/quantum-scene.html)**: A standalone 4-qubit scene with dedicated mic threshold simulations.

## 🛠 Project Structure

- `server.py`: FastAPI backend with PennyLane engine.
- `src/js/main.js`: Main visualization and Three.js orchestration.
- `src/js/black_hole_shader.js`: Complex GLSL code for astrophysical effects.
- `circuits/`: Python definitions for quantum circuits and diagram generators.
- `labs/`: Experimental tools and standalone visualizations.
- `shader/`: Raw GLSL assets.

## 📖 Deployment
For long-running installations or production environments, please refer to the **[PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md)** for Kiosk mode settings and macOS optimization.

---
*Created with focus on Computational Aesthetics and Quantum Engineering.*
