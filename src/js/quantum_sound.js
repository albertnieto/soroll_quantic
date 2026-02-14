export class QuantumSound {
    constructor() {
        this.initialized = false;
        this.enabled = false;

        // Volumes
        this.masterVolumeValue = 0.3;
        this.aiVolumeValue = 0.5;
        this.gateVolumeValue = 0.5;
        this.entanglementVolumeValue = 0.5;

        // Sound state
        this.entanglementIntensity = 0;
        this.styles = {
            gate: 'digital',
            entanglement: 'drone',
            collapse: 'thud'
        };
        this.isCalibrating = false;

        // Tone.js Components
        this.masterGain = null;
        this.aiGain = null;
        this.backgroundAudio = null;
        this.backgroundPlayer = null;
        this.gateSynth = null;
        this.entanglementSynth = null;
        this.collapseSynth = null;
        this.collapseFilter = null;

        // Reference Analysis for Real-Time Cancellation
        this.outputAnalyser = null;
        this.masterBuffer = null;
    }

    async init() {
        if (this.initialized) return;

        if (!window.Tone) {
            const module = await import('tone');
            window.Tone = module;
        }

        await Tone.start();

        this.masterGain = new Tone.Gain(this.masterVolumeValue).toDestination();

        // Real-Time Output Reference for Cancellation
        this.outputAnalyser = new Tone.Analyser("fft", 512);
        this.masterGain.connect(this.outputAnalyser);
        this.masterBuffer = new Uint8Array(this.outputAnalyser.size);

        // 1. Background Loop (Streaming for large files)
        this.backgroundAudio = new Audio("assets/audio/loops/track.wav");
        this.backgroundAudio.loop = true;

        this.aiGain = new Tone.Gain(this.aiVolumeValue).connect(this.masterGain);
        this.backgroundPlayer = Tone.getContext().createMediaElementSource(this.backgroundAudio);
        Tone.connect(this.backgroundPlayer, this.aiGain);

        // 2. Gate Synth (FM for variety)
        this.gateSynth = new Tone.PolySynth(Tone.FMSynth).connect(this.masterGain);
        this.updateGateStyle();

        // 3. Entanglement Synth
        this.entanglementSynth = new Tone.FMSynth().connect(this.masterGain);
        this.entanglementSynth.volume.value = -Infinity;
        this.updateEntanglementStyle();

        // 4. Collapse Synth (Refined - no more extreme noise)
        this.collapseFilter = new Tone.Filter(200, "lowpass").connect(this.masterGain);
        this.collapseSynth = new Tone.NoiseSynth().connect(this.collapseFilter);
        this.updateCollapseStyle();

        this.initialized = true;
    }

    updateGateStyle() {
        if (!this.gateSynth) return;
        const style = this.styles.gate;
        let settings = {};

        if (style === 'digital') {
            // Very sharp, high modulation blip
            settings = { harmonicity: 3, modulationIndex: 20, oscillator: { type: "square" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } };
        } else if (style === 'crystalline') {
            // Pure bell-like tone, long decay
            settings = { harmonicity: 0.5, modulationIndex: 2, oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.0 } };
        } else if (style === 'organic') {
            // Soft, breathing woodwind-like attack
            settings = { harmonicity: 1.0, modulationIndex: 0.5, oscillator: { type: "triangle" }, envelope: { attack: 0.2, decay: 0.4, sustain: 0.2, release: 0.4 } };
        }
        this.gateSynth.set(settings);
    }

    updateEntanglementStyle() {
        if (!this.entanglementSynth) return;
        const style = this.styles.entanglement;
        if (style === 'drone') {
            this.entanglementSynth.set({ harmonicity: 1.01, modulationIndex: 10, oscillator: { type: "sine" } });
        } else if (style === 'vibrant') {
            this.entanglementSynth.set({ harmonicity: 1.5, modulationIndex: 50, oscillator: { type: "sawtooth" } });
        } else if (style === 'shimmer') {
            this.entanglementSynth.set({ harmonicity: 3, modulationIndex: 5, oscillator: { type: "sine" } });
        }
    }

    updateCollapseStyle() {
        if (!this.collapseSynth) return;
        const style = this.styles.collapse;
        if (style === 'thud') {
            this.collapseFilter.frequency.value = 150;
            this.collapseSynth.set({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.4 } });
        } else if (style === 'glass') {
            this.collapseFilter.frequency.value = 5000;
            this.collapseSynth.set({ noise: { type: "white" }, envelope: { attack: 0.005, decay: 0.1 } });
        } else if (style === 'static') {
            this.collapseFilter.frequency.value = 10000;
            this.collapseSynth.set({ noise: { type: "white" }, envelope: { attack: 0.1, decay: 0.5 } });
        }
    }

    setStyle(type, style) {
        this.styles[type] = style;
        if (type === 'gate') this.updateGateStyle();
        if (type === 'entanglement') this.updateEntanglementStyle();
        if (type === 'collapse') this.updateCollapseStyle();
    }

    async toggle() {
        if (!this.initialized) await this.init();
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.backgroundAudio.play().catch(e => console.error("Playback failed:", e));
            this.entanglementSynth.triggerAttack("C2");
        } else {
            this.stopAll();
        }
        return this.enabled;
    }

    stopAll() {
        if (this.backgroundAudio) {
            this.backgroundAudio.pause();
            this.backgroundAudio.currentTime = 0;
        }
        if (this.gateSynth) this.gateSynth.releaseAll();
        if (this.entanglementSynth) this.entanglementSynth.triggerRelease();
        this.enabled = false;
    }

    playGateSound() {
        if (!this.enabled || !this.initialized) return;
        const notes = ["C4", "E4", "G4", "B4", "C5", "E5"];
        const note = notes[Math.floor(Math.random() * notes.length)];

        // Duration depends on style (crystalline needs more time)
        const duration = this.styles.gate === 'crystalline' ? "2n" : "16n";
        this.gateSynth.triggerAttackRelease(note, duration, undefined, this.gateVolumeValue * 0.5);
    }

    playCollapseSound() {
        if (!this.enabled || !this.initialized) return;
        this.collapseSynth.triggerAttackRelease("4n");
    }

    updateEntanglementSound(count) {
        if (!this.enabled || !this.initialized) return;
        const intensity = Math.min(count / 4, 1.0);
        // Use -100 for silence instead of -Infinity for smoother ramping
        const db = intensity > 0 ? Tone.gainToDb(intensity * 0.5 * this.entanglementVolumeValue) : -100;
        this.entanglementSynth.volume.rampTo(db, 0.05);
        this.entanglementSynth.modulationIndex.rampTo(intensity * 50, 0.05);
    }

    update(qubits) {
        if (!this.enabled || !this.initialized) return;

        let validLinks = 0;
        // Only count reciprocal, mutual links between coherent qubits
        for (let i = 0; i < qubits.length; i++) {
            const qA = qubits[i];
            if (!qA.coherent) continue;

            qA.entangledWith.forEach(targetId => {
                const qB = qubits[targetId];
                // A link is only valid if BOTH qubits recognize each other and are coherent
                if (qB && qB.coherent && qB.entangledWith.includes(i)) {
                    validLinks++;
                }
            });
        }

        // Divide by 2 because each mutual link is counted twice (A->B and B->A)
        this.updateEntanglementSound(validLinks / 2);
    }

    getOutputFFT() {
        if (!this.initialized || !this.outputAnalyser) return null;
        return this.outputAnalyser.getValue();
    }

    setMasterVolume(value) {
        this.masterVolumeValue = value / 100;
        if (this.masterGain) this.masterGain.gain.rampTo(this.masterVolumeValue, 0.1);
    }

    setAIVolume(value) {
        this.aiVolumeValue = value / 100;
        if (this.aiGain) this.aiGain.gain.rampTo(this.aiVolumeValue, 0.1);
    }

    setGateVolume(value) {
        this.gateVolumeValue = value / 100;
    }

    setEntanglementVolume(value) {
        this.entanglementVolumeValue = value / 100;
    }

    async runCalibrationSweep(micManager) {
        if (!this.initialized || !micManager || !micManager.enabled) {
            return { error: "Mic not active. Start Live Mic first." };
        }

        this.isCalibrating = true;
        micManager.startCalibration();

        // Capture for 3 seconds
        await new Promise(r => setTimeout(r, 3000));

        if (!this.isCalibrating) return { error: "Stopped" };

        const mask = micManager.stopCalibration();
        this.isCalibrating = false;
        return mask;
    }

    stopCalibrationSweep() {
        this.isCalibrating = false;
    }

    async saveCalibration(name, mask) { return true; }
    async loadCalibration(name, micManager) { return true; }
    async listCalibrations() { return []; }
    playGodRaySound() { this.playCollapseSound(); }
}

