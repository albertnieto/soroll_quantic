export class Qubit {
    constructor(id, position) {
        this.id = id;
        this.position = position;
        this.alpha = Math.cos(Math.random() * Math.PI / 2);
        this.beta = Math.sin(Math.random() * Math.PI / 2);
        this.phase = Math.random() * Math.PI * 2;
        this.coherent = true;
        this.entangledWith = [];
    }

    evolve(time) {
        // Phase evolution disabled - only changes via gates
    }

    collapse(finalState) {
        this.coherent = false;
        this.alpha = finalState === 0 ? 1 : 0;
        this.beta = finalState === 1 ? 1 : 0;
        this.entangledWith = []; // Clear local links
    }

    getProbability0() {
        return this.alpha * this.alpha;
    }

    getProbability1() {
        return this.beta * this.beta;
    }
}
