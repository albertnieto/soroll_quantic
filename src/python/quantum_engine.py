import pennylane as qml


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
        import numpy as np

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
            ]
            + [
                {
                    "type": "RY",
                    "wires": [i],
                    "params": [float(np.random.random() * np.pi)],
                }
                for i in range(4)
            ],
            "state_vector": [[float(s.real), float(s.imag)] for s in state],
            "num_qubits": self.num_qubits,
        }

    def get_quantum_chaos(self):
        # A circuit designed to evolve a lot and show complex behavior
        gates = []

        # Layer 1: Initial Superposition
        for i in range(self.num_qubits):
            gates.append({"type": "H", "wires": [i], "params": []})

        # Multiple Layers of Evolution
        num_layers = 4
        for layer in range(num_layers):
            # Rotations for color evolution (phase and amplitude)
            for i in range(self.num_qubits):
                # Pseudo-random but deterministic for this call
                angle_x = (layer + 1) * 0.4 + i * 0.2
                angle_y = (layer + 1) * 0.3 + i * 0.5
                angle_z = (layer + 1) * 0.7 + i * 0.3

                gates.append({"type": "RX", "wires": [i], "params": [angle_x]})
                gates.append({"type": "RY", "wires": [i], "params": [angle_y]})
                gates.append({"type": "RZ", "wires": [i], "params": [angle_z]})

            # Entanglement web
            for i in range(self.num_qubits - 1):
                gates.append({"type": "CNOT", "wires": [i, i + 1], "params": []})

            # Cross-entanglement
            gates.append(
                {"type": "CNOT", "wires": [self.num_qubits - 1, 0], "params": []}
            )

        @qml.qnode(self.dev)
        def circuit():
            # Apply gates to pennylane circuit for state vector calculation
            for g in gates:
                if g["type"] == "H":
                    qml.Hadamard(wires=g["wires"][0])
                elif g["type"] == "CNOT":
                    qml.CNOT(wires=g["wires"])
                elif g["type"] == "RX":
                    qml.RX(g["params"][0], wires=g["wires"][0])
                elif g["type"] == "RY":
                    qml.RY(g["params"][0], wires=g["wires"][0])
                elif g["type"] == "RZ":
                    qml.RZ(g["params"][0], wires=g["wires"][0])
            return qml.state()

        state = circuit()
        return {
            "gates": gates,
            "state_vector": [[float(s.real), float(s.imag)] for s in state],
            "num_qubits": self.num_qubits,
        }


engine = QuantumEngine()
