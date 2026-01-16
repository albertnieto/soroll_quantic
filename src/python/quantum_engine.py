import pennylane as qml
import numpy as np


class QuantumEngine:
    def __init__(self, num_qubits=4):
        self.num_qubits = num_qubits
        self.dev = qml.device("default.qubit", wires=num_qubits)

    def get_bell_state(self):
        @qml.qnode(self.dev)
        def circuit():
            qml.Hadamard(wires=0)
            qml.CNOT(wires=[0, 1])
            qml.Hadamard(wires=2)
            qml.CNOT(wires=[2, 3])
            qml.RY(0.5, wires=0)
            qml.RY(0.5, wires=2)
            return qml.state()

        state = circuit()
        return {
            "gates": [
                {"type": "H", "wires": [0], "params": []},
                {"type": "CNOT", "wires": [0, 1], "params": []},
                {"type": "H", "wires": [2], "params": []},
                {"type": "CNOT", "wires": [2, 3], "params": []},
                {"type": "RY", "wires": [0], "params": [0.5]},
                {"type": "RY", "wires": [2], "params": [0.5]},
            ],
            "state_vector": [[float(s.real), float(s.imag)] for s in state],
            "num_qubits": self.num_qubits,
        }

    def get_phase_evolution(self):
        @qml.qnode(self.dev)
        def circuit():
            for i in range(self.num_qubits):
                qml.Hadamard(wires=i)
                qml.RZ(0.1 * i, wires=i)
            return qml.state()

        state = circuit()
        gates = [{"type": "H", "wires": [i], "params": []} for i in range(4)] + [
            {"type": "RZ", "wires": [i], "params": [0.1 * i]} for i in range(4)
        ]
        return {
            "gates": gates,
            "state_vector": [[float(s.real), float(s.imag)] for s in state],
            "num_qubits": self.num_qubits,
        }

    def get_random_rotation(self):
        @qml.qnode(self.dev)
        def circuit():
            for i in range(self.num_qubits):
                qml.RX(np.random.random() * np.pi, wires=i)
                qml.RY(np.random.random() * np.pi, wires=i)
            return qml.state()

        state = circuit()
        return {
            "gates": [
                {
                    "type": "RX",
                    "wires": [i],
                    "params": [float(np.random.random() * np.pi)],
                }
                for i in range(4)
            ],
            "state_vector": [[float(s.real), float(s.imag)] for s in state],
            "num_qubits": self.num_qubits,
        }


engine = QuantumEngine()
