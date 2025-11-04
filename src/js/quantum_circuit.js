export class QuantumCircuit {
    constructor() {
        this.gates = [];
        this.currentGate = 0;
        this.stateVector = null;
        this.currentCircuit = 'bell_state';
    }

    async loadCircuit(circuitName = 'bell_state') {
        this.currentCircuit = circuitName;
        try {
            const response = await fetch(`/api/circuit?circuit=${circuitName}`);
            const data = await response.json();
            this.gates = [{"type": "INIT", "wires": [0, 1, 2, 3], "params": []}, ...data.gates];
            this.stateVector = data.state_vector;
            return data;
        } catch (error) {
            console.warn('Using fallback circuit (Python server not running)');
            if (circuitName === 'random_rotation') {
                this.gates = [
                    {"type": "INIT", "wires": [0, 1, 2, 3], "params": []},
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
                ];
                return { gates: this.gates, num_qubits: 4 };
            }
            this.gates = [
                {"type": "INIT", "wires": [0, 1, 2, 3], "params": []},
                {"type": "H", "wires": [0], "params": []},
                {"type": "CNOT", "wires": [0, 1], "params": []},
                {"type": "H", "wires": [2], "params": []},
                {"type": "CNOT", "wires": [2, 3], "params": []},
                {"type": "RY", "wires": [0], "params": [0.5]},
                {"type": "RY", "wires": [2], "params": [0.5]}
            ];
            return { gates: this.gates, num_qubits: 4 };
        }
    }

    nextGate() {
        if (this.currentGate < this.gates.length) {
            this.currentGate++;
            return this.gates[this.currentGate - 1];
        }
        return null;
    }

    reset() {
        this.currentGate = 0;
    }

    getCurrentGate() {
        return this.currentGate > 0 ? this.gates[this.currentGate - 1] : null;
    }

    getProgress() {
        return this.gates.length > 0 ? this.currentGate / this.gates.length : 0;
    }
}
