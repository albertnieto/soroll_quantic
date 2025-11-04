import pennylane as qml
import json
import sys

dev = qml.device('default.qubit', wires=4)

@qml.qnode(dev)
def bell_state_circuit():
    # Create Bell pairs (entanglement)
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    
    qml.Hadamard(wires=2)
    qml.CNOT(wires=[2, 3])
    
    # Additional gates for visualization
    qml.RY(0.5, wires=0)
    qml.RY(0.5, wires=2)
    
    return qml.state()

# Execute circuit
state = bell_state_circuit()

# Get circuit info
circuit_info = {
    "gates": [
        {"type": "H", "wires": [0], "params": []},
        {"type": "CNOT", "wires": [0, 1], "params": []},
        {"type": "H", "wires": [2], "params": []},
        {"type": "CNOT", "wires": [2, 3], "params": []},
        {"type": "RY", "wires": [0], "params": [0.5]},
        {"type": "RY", "wires": [2], "params": [0.5]}
    ],
    "state_vector": [[s.real, s.imag] for s in state],
    "num_qubits": 4
}

print(json.dumps(circuit_info))
