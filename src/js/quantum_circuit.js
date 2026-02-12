import { QuantumState } from './QuantumState.js';

export class QuantumCircuit {
    constructor() {
        this.gates = [];
        this.currentGate = 0;
        this.stateVector = null;
        this.currentCircuit = 'bell_state';
        this.quantumState = new QuantumState();
        this.entangledPairs = [];
    }

    async loadCircuit(circuitName = 'bell_state') {
        this.currentCircuit = circuitName;
        try {
            const response = await fetch(`/api/circuit?circuit=${circuitName}`);
            const data = await response.json();
            this.gates = [{ "type": "INIT", "wires": [0, 1, 2, 3], "params": [] }, ...data.gates];

            // Note: We don't use the backend state vector for visualization anymore
            // We simulate it client-side for step-by-step accuracy
            this.quantumState.reset();
            this.stateVector = this.quantumState.amplitudes;

            return data;
        } catch (error) {
            console.warn('Using fallback circuit (Python server not running)');
            if (circuitName === 'quantum_chaos') {
                this.gates = [
                    { "type": "INIT", "wires": [0, 1, 2, 3], "params": [] },
                    { "type": "H", "wires": [0], "params": [] },
                    { "type": "H", "wires": [1], "params": [] },
                    { "type": "H", "wires": [2], "params": [] },
                    { "type": "H", "wires": [3], "params": [] }
                ];
                // Add a few chaotic layers for fallback
                for (let l = 0; l < 3; l++) {
                    for (let i = 0; i < 4; i++) {
                        this.gates.push({ "type": "RX", "wires": [i], "params": [0.4 + l * 0.1] });
                        this.gates.push({ "type": "RY", "wires": [i], "params": [0.5 + i * 0.2] });
                        this.gates.push({ "type": "RZ", "wires": [i], "params": [0.3 + l * 0.5] });
                    }
                    this.gates.push({ "type": "CNOT", "wires": [0, 1], "params": [] });
                    this.gates.push({ "type": "CNOT", "wires": [1, 2], "params": [] });
                    this.gates.push({ "type": "CNOT", "wires": [2, 3], "params": [] });
                    this.gates.push({ "type": "CNOT", "wires": [3, 0], "params": [] });
                }
                return { gates: this.gates, num_qubits: 4 };
            }
            if (circuitName === 'random_rotation') {
                this.gates = [
                    { "type": "INIT", "wires": [0, 1, 2, 3], "params": [] },
                    { "type": "H", "wires": [0], "params": [] },
                    { "type": "H", "wires": [1], "params": [] },
                    { "type": "H", "wires": [2], "params": [] },
                    { "type": "H", "wires": [3], "params": [] },
                    { "type": "RX", "wires": [0], "params": [0.5] },
                    { "type": "RY", "wires": [1], "params": [0.7] },
                    { "type": "RZ", "wires": [2], "params": [0.3] },
                    { "type": "RX", "wires": [3], "params": [0.9] },
                    { "type": "CNOT", "wires": [0, 1], "params": [] },
                    { "type": "CNOT", "wires": [1, 2], "params": [] },
                    { "type": "CNOT", "wires": [2, 3], "params": [] }
                ];
                return { gates: this.gates, num_qubits: 4 };
            }
            this.gates = [
                { "type": "INIT", "wires": [0, 1, 2, 3], "params": [] },
                { "type": "H", "wires": [0], "params": [] },
                { "type": "CNOT", "wires": [0, 1], "params": [] },
                { "type": "H", "wires": [2], "params": [] },
                { "type": "CNOT", "wires": [2, 3], "params": [] },
                { "type": "RY", "wires": [0], "params": [0.5] },
                { "type": "RY", "wires": [2], "params": [0.5] }
            ];
            return { gates: this.gates, num_qubits: 4 };
        }
    }

    nextGate() {
        if (this.currentGate < this.gates.length) {
            this.currentGate++;
            const gate = this.gates[this.currentGate - 1];
            this.quantumState.applyGate(gate);

            // Basic Entanglement Tracking
            if (gate.type === 'CNOT') {
                // Heuristic: CNOT creates entanglement if control is in superposition
                // For viz purposes, we'll just track that they interacted
                this.entangledPairs.push([gate.wires[0], gate.wires[1]]);
            }
            if (gate.type === 'INIT') {
                this.entangledPairs = [];
            }

            return gate;
        }
        return null;
    }

    reset() {
        this.currentGate = 0;
        this.quantumState.reset();
    }

    getCurrentGate() {
        return this.currentGate > 0 ? this.gates[this.currentGate - 1] : null;
    }

    getProgress() {
        return this.gates.length > 0 ? this.currentGate / this.gates.length : 0;
    }
}
