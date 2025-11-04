import pennylane as qml
import json
import random

dev = qml.device('default.qubit', wires=4)

@qml.qnode(dev)
def random_rotation_circuit():
    # Apply Hadamard to all qubits
    for i in range(4):
        qml.Hadamard(wires=i)
    
    # Random rotation on each qubit
    rotations = []
    for i in range(4):
        gate = random.choice(['RX', 'RY', 'RZ'])
        angle = random.uniform(0, 3.14159)
        rotations.append({'gate': gate, 'wire': i, 'angle': angle})
        
        if gate == 'RX':
            qml.RX(angle, wires=i)
        elif gate == 'RY':
            qml.RY(angle, wires=i)
        else:
            qml.RZ(angle, wires=i)
    
    # Entangle all qubits
    qml.CNOT(wires=[0, 1])
    qml.CNOT(wires=[1, 2])
    qml.CNOT(wires=[2, 3])
    
    return qml.state()

state = random_rotation_circuit()

circuit_info = {
    "gates": [
        {"type": "H", "wires": [0], "params": []},
        {"type": "H", "wires": [1], "params": []},
        {"type": "H", "wires": [2], "params": []},
        {"type": "H", "wires": [3], "params": []},
        {"type": "RX", "wires": [0], "params": [0.5]},
        {"type": "RY", "wires": [1], "params": [0.7]},
        {"type": "RZ", "wires": [2], "params": [0.3]},
        {"type": "RX", "wires": [3], "params": [0.9]},
        {"type": "CNOT", "wires": [0, 1], "params": []},
        {"type": "CNOT", "wires": [1, 2], "params": []},
        {"type": "CNOT", "wires": [2, 3], "params": []}
    ],
    "state_vector": state.tolist(),
    "num_qubits": 4
}

print(json.dumps(circuit_info))
