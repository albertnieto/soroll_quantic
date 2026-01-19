export class QuantumState {
    constructor() {
        // 16 states, Real and Imaginary parts (32 floats)
        // |0000> is index 0
        this.amplitudes = new Float32Array(32);
        this.reset();
    }

    reset() {
        this.amplitudes.fill(0);
        this.amplitudes[0] = 1.0; // Initialize to |0000>
    }

    // Helper: Complex multiplication
    // (a + bi)(c + di) = (ac - bd) + (ad + bc)i

    applyGate(gate) {
        if (gate.type === 'H') {
            const target = gate.wires[0];
            this.applyHadamard(target);
        } else if (gate.type === 'CNOT') {
            const control = gate.wires[0];
            const target = gate.wires[1];
            this.applyCNOT(control, target);
        } else if (gate.type === 'RX') {
            this.applyRX(gate.wires[0], gate.params[0]);
        } else if (gate.type === 'RY') {
            this.applyRY(gate.wires[0], gate.params[0]);
        } else if (gate.type === 'RZ') {
            this.applyRZ(gate.wires[0], gate.params[0]);
        }
    }

    applyHadamard(targetWire) {
        const newAmps = new Float32Array(32);
        const invSqrt2 = 0.70710678;

        for (let i = 0; i < 16; i++) {
            // If bit at targetWire is 0, it contributes to |0> and |1>
            // If bit at targetWire is 1, it contributes to |0> and -|1>

            // Check if current index i has 0 or 1 at targetWire
            const bit = (i >> targetWire) & 1;

            // The "partner" index is i with the target bit flipped
            const partner = i ^ (1 << targetWire);

            const idx = i * 2;
            const pIdx = partner * 2;

            // Current amp
            const cr = this.amplitudes[idx];
            const ci = this.amplitudes[idx + 1];

            if (bit === 0) {
                // This state |...0...> corresponds to |0> input
                // Output is (|0> + |1>) / sqrt(2)
                // So it contributes to |...0...> (itself) and |...1...> (partner)

                // We process pairs, so we only need to iterate where bit is 0?
                // No, standard loop is simpler: H |x> = ...
                // H|0> = (|0> + |1>)/s2
                // H|1> = (|0> - |1>)/s2

                // Since this simulation needs to be in-place or copies, calculating for 'i' requires knowing source.
                // It's easier to iterate pairs.
            }
        }

        // Better loop: Iterate over all states where target bit is 0
        for (let i = 0; i < 16; i++) {
            if (((i >> targetWire) & 1) === 0) {
                const zeroState = i;
                const oneState = i | (1 << targetWire);

                const z_idx = zeroState * 2;
                const o_idx = oneState * 2;

                const zr = this.amplitudes[z_idx];
                const zi = this.amplitudes[z_idx + 1];
                const or = this.amplitudes[o_idx];
                const oi = this.amplitudes[o_idx + 1];

                // New Zero = (OldZero + OldOne) * s2
                newAmps[z_idx] = (zr + or) * invSqrt2;
                newAmps[z_idx + 1] = (zi + oi) * invSqrt2;

                // New One = (OldZero - OldOne) * s2
                newAmps[o_idx] = (zr - or) * invSqrt2;
                newAmps[o_idx + 1] = (zi - oi) * invSqrt2;
            }
        }
        this.amplitudes = newAmps;
    }

    applyCNOT(control, target) {
        const newAmps = new Float32Array(this.amplitudes);

        for (let i = 0; i < 16; i++) {
            // If control bit is set, swap target 0/1 states
            if (((i >> control) & 1) === 1) {
                // If target bit is 0, we verify if we processed this pair
                if (((i >> target) & 1) === 0) {
                    const idx0 = i;
                    const idx1 = i | (1 << target);

                    const i0 = idx0 * 2;
                    const i1 = idx1 * 2;

                    // Swap amplitudes
                    const tempR = newAmps[i0];
                    const tempI = newAmps[i0 + 1];
                    newAmps[i0] = newAmps[i1];
                    newAmps[i0 + 1] = newAmps[i1 + 1];
                    newAmps[i1] = tempR;
                    newAmps[i1 + 1] = tempI;
                }
            }
        }
        this.amplitudes = newAmps;
    }

    applyRX(wire, theta) {
        // Rx(theta) = [ cos(t/2)   -i*sin(t/2) ]
        //             [ -i*sin(t/2)  cos(t/2)  ]
        const c = Math.cos(theta / 2);
        const s = Math.sin(theta / 2);
        const newAmps = new Float32Array(32);

        for (let i = 0; i < 16; i++) {
            if (((i >> wire) & 1) === 0) {
                const idx0 = i * 2;
                const idx1 = (i | (1 << wire)) * 2;

                const r0 = this.amplitudes[idx0];
                const i0 = this.amplitudes[idx0 + 1];
                const r1 = this.amplitudes[idx1];
                const i1 = this.amplitudes[idx1 + 1];

                // New 0 = c*|0> - i*s*|1>
                newAmps[idx0] = r0 * c + i1 * s;
                newAmps[idx0 + 1] = i0 * c - r1 * s;

                // New 1 = -i*s*|0> + c*|1>
                newAmps[idx1] = r1 * c + i0 * s;
                newAmps[idx1 + 1] = i1 * c - r0 * s;
            }
        }
        this.amplitudes = newAmps;
    }

    applyRY(wire, theta) {
        // Ry(theta) = [ cos(t/2)   -sin(t/2) ]
        //             [ sin(t/2)    cos(t/2) ]
        const c = Math.cos(theta / 2);
        const s = Math.sin(theta / 2);
        const newAmps = new Float32Array(32);

        for (let i = 0; i < 16; i++) {
            if (((i >> wire) & 1) === 0) {
                const idx0 = i * 2;
                const idx1 = (i | (1 << wire)) * 2;

                const r0 = this.amplitudes[idx0];
                const i0 = this.amplitudes[idx0 + 1];
                const r1 = this.amplitudes[idx1];
                const i1 = this.amplitudes[idx1 + 1];

                // New 0 = c*|0> - s*|1>
                newAmps[idx0] = r0 * c - r1 * s;
                newAmps[idx0 + 1] = i0 * c - i1 * s;

                // New 1 = s*|0> + c*|1>
                newAmps[idx1] = r0 * s + r1 * c;
                newAmps[idx1 + 1] = i0 * s + i1 * c;
            }
        }
        this.amplitudes = newAmps;
    }

    applyRZ(wire, theta) {
        const c = Math.cos(theta / 2);
        const s = Math.sin(theta / 2);
        const newAmps = new Float32Array(32);

        for (let i = 0; i < 16; i++) {
            const idx = i * 2;
            const bit = (i >> wire) & 1;
            const r = this.amplitudes[idx];
            const im = this.amplitudes[idx + 1];

            if (bit === 0) {
                // e^(-it/2) = c - is
                newAmps[idx] = r * c + im * s;
                newAmps[idx + 1] = im * c - r * s;
            } else {
                // e^(it/2) = c + is
                newAmps[idx] = r * c - im * s;
                newAmps[idx + 1] = im * c + r * s;
            }
        }
        this.amplitudes = newAmps;
    }
}
