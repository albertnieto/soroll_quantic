export class QuantumSound {
    constructor() {
        this.initialized = false;
        this.enabled = false;
        this.mode = 'hybrid'; // 'atmospheric', 'synthetic', 'hybrid', 'interactive'

        // Volumes
        this.masterVolumeValue = 0.3;
        this.aiVolumeValue = 0.5;
        this.quantumVolumeValue = 0.5;

        // Quantum Synth Paramaters
        this.bassDepth = 0.5;
        this.resonance = 0.5;

        // Tone.js Components
        this.masterGain = null;
        this.limiter = null;
        this.reverb = null;
        this.quantumSynth = null;
        this.aiPlayers = null;
        this.micProcessor = null;

        this.baseNotes = ["C2", "E2", "G2", "C3"];
    }

    async init() {
        if (this.initialized) return;

        await Tone.start();
        console.log("Tone.js context started");

        // 1. Master Chain: Limiter -> Reverb -> Destination
        this.limiter = new Tone.Limiter(-2).toDestination();
        this.reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.3
        }).connect(this.limiter);

        this.masterGain = new Tone.Gain(this.masterVolumeValue).connect(this.reverb);

        // 2. Quantum Synth Engine
        // Use an FMSynth for richer textures than raw sines
        this.quantumSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1.5,
            modulationIndex: 10,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.1,
                decay: 0.2,
                sustain: 0.5,
                release: 1
            },
            modulation: { type: "triangle" },
            modulationEnvelope: {
                attack: 0.5,
                decay: 0,
                sustain: 1,
                release: 0.5
            }
        }).connect(this.masterGain);

        // 3. AI Atmospheric Loops
        this.aiPlayers = new Tone.Players({
            void: "assets/audio/loops/ambient/quantum_void.wav",
            glass: "assets/audio/loops/harmonic/glass_superposition.wav",
            pulse: "assets/audio/loops/rhythmic/entangled_pulse.wav",
            noise: "assets/audio/loops/glitch/decoherence_noise.wav"
        }, () => {
            console.log("AI Loops loaded");
            // Set all to loop
            Object.values(this.aiPlayers._players).forEach(p => {
                p.loop = true;
                p.fadeIn = 2;
                p.fadeOut = 2;
            });
        }).connect(this.masterGain);

        this.aiPlayers.volume.value = Tone.gainToDb(this.aiVolumeValue);
        this.quantumSynth.volume.value = Tone.gainToDb(this.quantumVolumeValue);

        this.initialized = true;
    }

    toggle() {
        if (!this.initialized) {
            this.init();
        }
        this.enabled = !this.enabled;

        if (this.enabled) {
            this.updateMode();
        } else {
            this.stopAll();
        }
        return this.enabled;
    }

    setMode(mode) {
        this.mode = mode;
        if (this.enabled) this.updateMode();
    }

    updateMode() {
        if (!this.initialized || !this.enabled) return;

        this.stopAll();

        switch (this.mode) {
            case 'atmospheric':
                this.startAILoops();
                break;
            case 'synthetic':
                // Quantum synth is triggered by update(qubits)
                break;
            case 'hybrid':
                this.startAILoops();
                break;
            case 'interactive':
                this.startMicProcessing();
                break;
        }
    }

    startAILoops() {
        if (this.aiPlayers) {
            // Randomly start 2 loops for texture
            this.aiPlayers.player("void").start();
            this.aiPlayers.player("glass").start();
        }
    }

    startMicProcessing(micSource) {
        if (!this.initialized || !micSource) return;

        // Use Tone.ExternalInput to wrap the mic source
        // Note: micSource is a MediaStreamAudioSourceNode from micManager
        this.micProcessor = new Tone.UserMedia();

        // Connect the mic to a series of effects controlled by quantum state
        this.micDelay = new Tone.PingPongDelay("4n", 0.4).connect(this.masterGain);
        this.micReverb = new Tone.Reverb(4).connect(this.micDelay);

        // Connect to the Tone.js graph
        this.micProcessor.open().then(() => {
            this.micProcessor.connect(this.micReverb);
            console.log("Mic successfully routed to Tone.js processing");
        });
    }

    stopAll() {
        if (this.aiPlayers) {
            Object.values(this.aiPlayers._players).forEach(p => p.stop());
        }
        if (this.quantumSynth) {
            this.quantumSynth.releaseAll();
        }
        if (this.micProcessor) {
            this.micProcessor.close();
            this.micDelay.dispose();
            this.micReverb.dispose();
        }
    }

    update(qubits) {
        if (!this.enabled || !this.initialized) return;

        qubits.forEach((qubit, i) => {
            const prob0 = qubit.getProbability0();
            const prob1 = qubit.getProbability1();
            const phase = qubit.phase;

            // Map quantum state to synth
            if (this.mode === 'synthetic' || this.mode === 'hybrid') {
                const note = this.baseNotes[i];

                // If coherent, we play the note
                if (qubit.coherent) {
                    const velocity = 0.2 + (prob1 * 0.3); // probability influences volume
                    this.quantumSynth.triggerAttack(note, Tone.now(), velocity);

                    // Modulate parameters based on phase
                    const modIndex = 5 + Math.abs(Math.sin(phase)) * 20;
                    this.quantumSynth.set({
                        modulationIndex: modIndex
                    });
                } else {
                    this.quantumSynth.triggerRelease(note);
                }
            } else if (this.mode === 'interactive' && this.micProcessor) {
                // Modulate mic effects using all qubits (aggregated)
                const totalProb1 = qubits.reduce((acc, q) => acc + q.getProbability1(), 0) / 4;
                const totalSuper = qubits.reduce((acc, q) => acc + (4 * q.getProbability0() * q.getProbability1()), 0) / 4;

                // Superposition increases Delay feedback
                this.micDelay.feedback.rampTo(0.2 + totalSuper * 0.6, 0.1);

                // Prob1 increases Reverb wetness
                this.micReverb.wet.rampTo(0.1 + totalProb1 * 0.7, 0.1);
            }
        });
    }

    setMasterVolume(value) {
        this.masterVolumeValue = value / 100;
        if (this.masterGain) {
            this.masterGain.gain.rampTo(this.masterVolumeValue, 0.1);
        }
    }

    setAIVolume(value) {
        this.aiVolumeValue = value / 100;
        if (this.aiPlayers) {
            this.aiPlayers.volume.rampTo(Tone.gainToDb(this.aiVolumeValue), 0.1);
        }
    }

    setQuantumVolume(value) {
        this.quantumVolumeValue = value / 100;
        if (this.quantumSynth) {
            this.quantumSynth.volume.rampTo(Tone.gainToDb(this.quantumVolumeValue), 0.1);
        }
    }

    setBassDepth(value) {
        this.bassDepth = value / 100;
    }

    setResonance(value) {
        this.resonance = value / 100;
        if (this.reverb) {
            this.reverb.wet.rampTo(0.1 + this.resonance * 0.5, 0.5);
        }
    }

    cleanup() {
        this.stopAll();
        if (this.initialized) {
            Tone.Transport.stop();
            this.masterGain.dispose();
            this.limiter.dispose();
            this.reverb.dispose();
            this.quantumSynth.dispose();
            this.aiPlayers.dispose();
            this.initialized = false;
        }
    }
}
