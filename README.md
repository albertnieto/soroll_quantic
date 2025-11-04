# Lluc Llum - Quantum Qubit Visualization

A WebGL-based quantum circuit visualization using Three.js with custom GLSL shaders and PennyLane integration.

## Features

- 4 interactive qubits with quantum state evolution
- Entanglement visualization with orbital shaders
- Quantum-based shaders using wave functions and probability amplitudes
- PennyLane circuit integration with gate-by-gate execution
- Real-time state monitoring and circuit diagram
- Mic threshold controls for qubit collapse simulation

## Setup

### Install Python Dependencies
```bash
pip3 install -r requirements.txt
```

### Run Server
```bash
python3 server.py
```

Then open http://localhost:8000

## Usage

1. **Auto Execute** - Automatically runs circuit gates in sequence
2. **Next Gate** - Execute next gate manually
3. **Reset Circuit** - Reset all qubits to |0⟩ state
4. **Mic Controls** - Simulate measurement (collapse when > 0.7)
5. **Qubit Spacing** - Adjust distance between qubits (default 8.5)

## Circuit

The Bell state circuit creates entanglement between qubit pairs:
- H → Q0 (Hadamard on qubit 0)
- CNOT → Q0,Q1 (Entangle qubits 0 and 1)
- H → Q2 (Hadamard on qubit 2)
- CNOT → Q2,Q3 (Entangle qubits 2 and 3)
- RY(0.5) → Q0 (Rotation on qubit 0)
- RY(0.5) → Q2 (Rotation on qubit 2)

## Shaders

- **Quantum Shader**: Wave functions, probability amplitudes, interference
- **Orbital Shader**: Entanglement visualization with portal effects
- **Plasma Shader**: Background texture with noise-based patterns

## Files

- `server.py` - Python server with PennyLane integration
- `circuits/bell_state.py` - Circuit definition and execution
- `circuits/plot_circuit.py` - Circuit diagram generation
- `src/js/main.js` - Main visualization logic
- `src/js/quantum_circuit.js` - Circuit management
- `src/js/Qubit.js` - Qubit state class
- `src/js/shaders.js` - GLSL shader definitions
