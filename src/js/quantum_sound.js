export class QuantumSound {
    constructor() {
        this.audioContext = null;
        this.oscillators = [];
        this.gainNodes = [];
        this.filterNodes = [];
        this.masterGain = null;
        this.enabled = false;
        this.volume = 0.3;
        this.bassDepth = 0.5;
        this.resonance = 0.5;
        
        // Base frequencies in Hz - deep harmonic series (C1, E1, G1, C2)
        this.baseFrequencies = [32.70, 41.20, 49.00, 65.41];
    }
    
    init() {
        if (this.audioContext) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.audioContext.destination);
        
        // Create 4 oscillators for 4 qubits
        for (let i = 0; i < 4; i++) {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = this.baseFrequencies[i];
            
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            filter.Q.value = 1 + this.resonance * 9;
            
            const gain = this.audioContext.createGain();
            gain.gain.value = 0;
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            
            this.oscillators.push(osc);
            this.gainNodes.push(gain);
            this.filterNodes.push(filter);
        }
    }
    
    toggle() {
        if (!this.audioContext) {
            this.init();
        }
        
        this.enabled = !this.enabled;
        
        if (!this.enabled) {
            this.gainNodes.forEach(gain => {
                gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
            });
        }
        
        return this.enabled;
    }
    
    update(qubits) {
        if (!this.enabled || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        
        qubits.forEach((qubit, i) => {
            const prob0 = qubit.getProbability0();
            const prob1 = qubit.getProbability1();
            const phase = qubit.phase;
            
            // Frequency modulation based on quantum state
            // Superposition creates harmonic intervals
            const bassMultiplier = 1 - (this.bassDepth * 0.5);
            const freqMod = 1 + (prob1 * 0.5); // Up to 1.5x base frequency
            const phaseFreq = this.baseFrequencies[i] * freqMod * bassMultiplier;
            
            this.oscillators[i].frequency.linearRampToValueAtTime(
                phaseFreq, 
                now + 0.1
            );
            
            // Volume based on coherence and probability
            let targetGain = 0;
            if (qubit.coherent) {
                // Superposition = louder, pure states = quieter
                const superposition = 4 * prob0 * prob1; // Max at 0.5/0.5
                targetGain = 0.15 + superposition * 0.25;
            } else {
                targetGain = 0.05; // Collapsed state is quiet
            }
            
            this.gainNodes[i].gain.linearRampToValueAtTime(targetGain, now + 0.2);
            
            // Filter modulation based on phase and resonance
            const filterFreq = 400 + Math.abs(Math.sin(phase)) * 1200;
            this.filterNodes[i].frequency.linearRampToValueAtTime(filterFreq, now + 0.1);
            this.filterNodes[i].Q.value = 1 + this.resonance * 9;
        });
    }
    
    setVolume(value) {
        this.volume = value;
        if (this.masterGain) {
            this.masterGain.gain.linearRampToValueAtTime(value, this.audioContext.currentTime + 0.1);
        }
    }
    
    setBassDepth(value) {
        this.bassDepth = value;
    }
    
    setResonance(value) {
        this.resonance = value;
    }
    
    cleanup() {
        if (this.oscillators.length > 0) {
            this.oscillators.forEach(osc => osc.stop());
            this.oscillators = [];
            this.gainNodes = [];
            this.filterNodes = [];
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
