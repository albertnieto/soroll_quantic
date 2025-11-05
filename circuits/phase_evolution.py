import pennylane as qml
import json
import sys

dev = qml.device('default.qubit', wires=4)

@qml.qnode(dev)
def phase_evolution_circuit():
    # Gradual entanglement with phase changes
    qml.Hadamard(wires=0)
    qml.RZ(0.3, wires=0)
    
    qml.Hadamard(wires=1)
    qml.RZ(0.5, wires=1)
    
    qml.CNOT(wires=[0, 1])
    qml.RY(0.4, wires=0)
    qml.RY(0.6, wires=1)
    
    qml.Hadamard(wires=2)
    qml.RZ(0.7, wires=2)
    
    qml.Hadamard(wires=3)
    qml.RZ(0.9, wires=3)
    
    qml.CNOT(wires=[2, 3])
    qml.RY(0.8, wires=2)
    qml.RY(1.0, wires=3)
    
    qml.CNOT(wires=[1, 2])
    qml.RZ(1.2, wires=1)
    qml.RZ(1.4, wires=2)
    
    qml.RY(1.1, wires=0)
    qml.RY(1.3, wires=3)
    
    return qml.state()

state = phase_evolution_circuit()

circuit_info = {
    "gates": [
        {"type": "H", "wires": [0], "params": []},
        {"type": "RZ", "wires": [0], "params": [0.3]},
        {"type": "H", "wires": [1], "params": []},
        {"type": "RZ", "wires": [1], "params": [0.5]},
        {"type": "CNOT", "wires": [0, 1], "params": []},
        {"type": "RY", "wires": [0], "params": [0.4]},
        {"type": "RY", "wires": [1], "params": [0.6]},
        {"type": "H", "wires": [2], "params": []},
        {"type": "RZ", "wires": [2], "params": [0.7]},
        {"type": "H", "wires": [3], "params": []},
        {"type": "RZ", "wires": [3], "params": [0.9]},
        {"type": "CNOT", "wires": [2, 3], "params": []},
        {"type": "RY", "wires": [2], "params": [0.8]},
        {"type": "RY", "wires": [3], "params": [1.0]},
        {"type": "CNOT", "wires": [1, 2], "params": []},
        {"type": "RZ", "wires": [1], "params": [1.2]},
        {"type": "RZ", "wires": [2], "params": [1.4]},
        {"type": "RY", "wires": [0], "params": [1.1]},
        {"type": "RY", "wires": [3], "params": [1.3]}
    ],
    "state_vector": [[s.real, s.imag] for s in state],
    "num_qubits": 4
}

print(json.dumps(circuit_info))
