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
        this.aiPlayers = null; // This will be replaced by crossfader, playerA, playerB
        this.micProcessor = null;

        this.baseNotes = ["C2", "E2", "G2", "C3"];
        this.activeNotes = new Set();
        this.manifest = null; // Will hold { "ambient": ["track_01.wav", ...], ... }
        this.isCalibrating = false;
    }

    async init() {
        if (this.initialized) return;

        if (!window.Tone) {
            console.log("[QuantumSound] Loading Tone.js dynamically...");
            // Use esm.sh for a reliable ESM module of Tone.js
            const module = await import('tone');
            window.Tone = module;
            console.log("[QuantumSound] Tone.js loaded.");
        }

        await Tone.start();

        // Master Effects Chain
        this.masterGain = new Tone.Gain(this.masterVolumeValue).toDestination();
        this.limiter = new Tone.Limiter(-2).connect(this.masterGain);
        this.reverb = new Tone.Reverb({
            decay: 10,
            preDelay: 0.2,
            wet: 0.3
        }).connect(this.limiter);

        // --- 1. Quantum Synth (FM & AM) ---
        this.quantumSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1.5,
            modulationIndex: 10,
            oscillator: { type: "sine" },
            envelope: {
                attack: 0.5,
                decay: 2,
                sustain: 0.5,
                release: 4
            },
            modulation: { type: "square" },
            modulationEnvelope: {
                attack: 0.5,
                decay: 0,
                sustain: 1,
                release: 0.5
            }
        }).connect(this.reverb);

        // --- 2. Smart Shuffle Engine (CrossFadeManager) ---
        this.activeCategory = 'ambient';
        this.crossfader = new Tone.CrossFade(0).connect(this.reverb);

        this.playerA = new Tone.Player().connect(this.crossfader.a);
        this.playerB = new Tone.Player().connect(this.crossfader.b);

        // Track History to avoid repetition
        this.trackHistory = [];
        this.categories = ['ambient', 'harmonic', 'rhythmic', 'glitch'];

        this.initialized = true;

        // Start checking for manifest
        this.pollManifest();
    }

    async pollManifest() {
        await this.loadManifest();
        if (this.manifest && Object.keys(this.manifest).length > 0) {
            console.log("[QuantumSound] Manifest loaded and ready.");
            // Only start transition if not already playing/scheduled to avoid double playback?
            // Actually scheduleNextTransition checks if Tone is running.
            // But we might want to ensure we don't call it multiple times if poll called multiple times.
            // For now, this is fine because we stop polling on success.
            this.scheduleNextTransition(1);
        } else {
            console.warn("[QuantumSound] No audio manifest found yet. Retrying in 5s...");
            setTimeout(() => this.pollManifest(), 5000);
        }
    }

    async loadManifest() {
        try {
            const response = await fetch('/api/audio-manifest');
            if (response.ok) {
                this.manifest = await response.json();
                console.log("[QuantumSound] Audio Manifest Loaded:", this.manifest);

                // Update categories based on what we actually have
                const availableCategories = Object.keys(this.manifest);
                if (availableCategories.length > 0) {
                    this.categories = availableCategories;
                }
            } else {
                console.warn("[QuantumSound] Failed to load audio manifest");
            }
        } catch (e) {
            console.error("[QuantumSound] Error loading audio manifest:", e);
        }
    }

    // --- Smart Shuffle Logic ---
    async scheduleNextTransition(delaySeconds = 0, retryCount = 0) {
        if (!this.manifest || Object.keys(this.manifest).length === 0) {
            console.warn("[QuantumSound] Manifest empty, retrying manifest load...");
            await this.loadManifest();
            if (!this.manifest || Object.keys(this.manifest).length === 0) {
                setTimeout(() => this.scheduleNextTransition(0, 0), 5000);
                return;
            }
        }

        if (retryCount > 20) {
            console.warn("[QuantumSound] Max retries reached. Waiting 10s before trying again.");
            setTimeout(() => this.scheduleNextTransition(0, 0), 10000);
            return;
        }

        // 1. Pick a category based on "Smart Shuffle" (rotate)
        // If we are retrying, we MUST advance the category index to avoid getting stuck 
        // in an empty active category (like 'harmonic' which is empty right now).
        // offset = 1 (normal next) + retryCount. 
        // If retry 0: next + 1. If retry 1 (fail): next + 2. etc.
        const offset = 1 + retryCount;

        // Ensure we accept whatever categories are in the manifest
        const availableCategories = Object.keys(this.manifest);
        if (availableCategories.length === 0) return; // Should be handled above

        // Use availableCategories instead of this.categories to be safe, or sync them
        const nextCatIdx = (availableCategories.indexOf(this.activeCategory) + offset) % availableCategories.length;
        // If nextCatIdx is -1 (current inactive not found), start at 0
        const actualIdx = nextCatIdx >= 0 ? nextCatIdx : 0;

        let nextCategory = availableCategories[actualIdx];

        // Get tracks for this category
        const tracks = this.manifest[nextCategory];
        if (!tracks || tracks.length === 0) {
            // Category has no tracks, skip to next immediately
            console.log(`[QuantumSound] Category ${nextCategory} is empty, skipping...`);
            this.scheduleNextTransition(0, retryCount + 1);
            return;
        }

        // 2. Pick a track from the manifest
        const trackName = tracks[Math.floor(Math.random() * tracks.length)];
        const url = `assets/audio/loops/${nextCategory}/${trackName}`;

        // Don't log every retry if we are spamming
        if (retryCount === 0) {
            console.log(`[QuantumSound] Scheduling next: ${nextCategory}/${trackName} in ${delaySeconds}s`);
        }

        // 3. Determine which player is "Next" (not currently playing)
        const nextPlayer = (this.crossfader.fade.value > 0.5) ? this.playerA : this.playerB;
        const targetFade = (this.crossfader.fade.value > 0.5) ? 0 : 1;

        // 4. Load Buffer & Transition
        setTimeout(async () => {
            try {
                // This will throw if 404
                await nextPlayer.load(url);

                // --- SUCCESS ---
                nextPlayer.start();
                nextPlayer.volume.value = Tone.gainToDb(this.aiVolumeValue);

                // Long Linear Crossfade (30s)
                this.crossfader.fade.rampTo(targetFade, 30);

                // Update State
                this.activeCategory = nextCategory;
                this.trackHistory.push(trackName);
                if (this.trackHistory.length > 10) this.trackHistory.shift();

                // Schedule the NEXT transition (staggered 3-5 mins)
                const nextDuration = (180 + Math.random() * 120);
                this.scheduleNextTransition(nextDuration);

            } catch (e) {
                // --- FAILURE (File doesn't exist yet) ---
                // Silently retry immediately with a different random choice
                // This creates the "just grab what there is" behavior
                console.error(`[QuantumSound] Failed to load ${url}:`, e);
                this.scheduleNextTransition(0, retryCount + 1);
            }

        }, delaySeconds * 1000);
    }

    pickRandomTrack(category) {
        // Deprecated by the robust logic above, but kept if needed for utils
        // We assume 1-8.
        const trackNum = Math.floor(Math.random() * 8) + 1;
        return `track_${trackNum.toString().padStart(2, '0')}.wav`;
    }

    async toggle() {
        if (!this.initialized) {
            await this.init();
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
        this.updateMode();
    }

    updateMode() {
        if (!this.initialized || !this.enabled) return;

        // In 'synthetic' mode, we might want to pause the loop players to save CPU
        // But for 'smoothness', we might just mute them. 
        // For now, we'll keep them running but muted if not in a valid mode, 
        // OR we can stop them. Let's Stop them to be safe on CPU.

        if (this.mode === 'synthetic') {
            if (this.playerA) this.playerA.stop();
            if (this.playerB) this.playerB.stop();
        } else {
            // Atmospheric, Hybrid, Interactive -> We want the bg loop
            // If neither is playing, start the active one
            if (this.playerA && this.playerB) {
                if (this.playerA.state !== 'started' && this.playerB.state !== 'started') {
                    // Kickstart the cycle
                    this.scheduleNextTransition(0);
                }
            }
        }

        if (this.mode === 'interactive') {
            this.startMicProcessing();
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
        if (this.playerA) this.playerA.stop();
        if (this.playerB) this.playerB.stop();

        if (this.quantumSynth) {
            this.quantumSynth.releaseAll();
            this.activeNotes.clear();
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

                // If coherent, we ensure the note is playing
                if (qubit.coherent) {
                    // Only trigger attack if NOT already playing to avoid Polyphony Explosion
                    if (!this.activeNotes.has(note)) {
                        const velocity = 0.2 + (prob1 * 0.3);
                        this.quantumSynth.triggerAttack(note, Tone.now(), velocity);
                        this.activeNotes.add(note);
                    }

                    // Modulate parameters based on phase (continuous)
                    const modIndex = 5 + Math.abs(Math.sin(phase)) * 20;
                    this.quantumSynth.set({
                        modulationIndex: modIndex
                    });

                } else {
                    // If not coherent, ensure it stops
                    if (this.activeNotes.has(note)) {
                        this.quantumSynth.triggerRelease(note);
                        this.activeNotes.delete(note);
                    }
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
        if (window.Tone && this.playerA) {
            const db = Tone.gainToDb(this.aiVolumeValue);
            this.playerA.volume.rampTo(db, 0.1);
            if (this.playerB) this.playerB.volume.rampTo(db, 0.1);
        }
    }

    setQuantumVolume(value) {
        this.quantumVolumeValue = value / 100;
        if (this.quantumSynth && window.Tone) {
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

    async runCalibrationSweep(micManager) {
        if (!this.initialized) {
            console.log("[QuantumSound] Auto-initializing for calibration...");
            await this.init();
        }

        if (!micManager) {
            console.error("[QuantumSound] Calibration Failed: MicManager instance is missing.");
            return { error: "Internal Error: MicManager missing" };
        }

        if (!micManager.enabled) {
            console.warn("[QuantumSound] Calibration Failed: Microphone is not enabled.");
            return { error: "Microphone not active. Click 'Start Live Mic' first." };
        }

        this.isCalibrating = true;
        console.log("[QuantumSound] Starting high-speed calibration sweep...");

        // 1. Enter calibration mode
        micManager.startCalibration();
        const originalVolume = this.masterVolumeValue;
        this.setMasterVolume(100); // Max volume for sweep

        // 2. Sweep the Synth (High speed frequency hops)
        const sweepNotes = ["C1", "G1", "C2", "G2", "C3", "G3", "C4", "G4", "C5"];
        for (const note of sweepNotes) {
            if (!this.isCalibrating) {
                micManager.abortCalibration();
                this.setMasterVolume(originalVolume * 100);
                return { error: "Calibration Stopped by User" };
            }
            this.quantumSynth.triggerAttackRelease(note, "16n");
            await new Promise(r => setTimeout(r, 150));
        }

        // 3. Sweep the Samples (Rapid bursts of every track)
        if (!this.manifest) {
            console.log("[QuantumSound] Manifest missing, attempting reload...");
            await this.loadManifest();
        }

        if (this.manifest && Object.keys(this.manifest).length > 0) {
            const categories = Object.keys(this.manifest);
            console.log(`[QuantumSound] Starting sample sweep. Categories: ${categories.length}`);
            for (const cat of categories) {
                const tracks = this.manifest[cat];
                console.log(`[QuantumSound] Sweeping category ${cat} (${tracks.length} tracks)`);
                for (const track of tracks) {
                    if (!this.isCalibrating) {
                        micManager.abortCalibration();
                        this.setMasterVolume(originalVolume * 100);
                        this.isCalibrating = false;
                        return { error: "Calibration Stopped by User" };
                    }
                    const url = `assets/audio/loops/${cat}/${track}`;
                    try {
                        // Use a temporary player for the sweep to not interrupt current playback
                        const sweepPlayer = new Tone.Player(url).toDestination();
                        await sweepPlayer.load(url);
                        sweepPlayer.start();
                        await new Promise(r => setTimeout(r, 400)); // Play 400ms burst
                        sweepPlayer.stop();
                        sweepPlayer.dispose();
                    } catch (e) {
                        // Only warn if it's not a user-abort
                        if (this.isCalibrating) {
                            console.warn(`[QuantumSound] Sweep failed for ${url}: ${e.message}`);
                        }
                    }
                }
            }
        }
    }
} else {
    console.log("[QuantumSound] Manifest is empty or missing. Skipping sample sweep (Synth only calibration).");
}

if (!this.isCalibrating) {
    micManager.abortCalibration();
    this.setMasterVolume(originalVolume * 100);
    this.isCalibrating = false; // Ensure flag is reset on early exit
    return { error: "Calibration Stopped by User" };
}

// 4. Capture and Save
const mask = micManager.stopCalibration();
this.setMasterVolume(originalVolume * 100);
this.isCalibrating = false;

console.log("[QuantumSound] Sweep complete.");
return mask;
    }

stopCalibrationSweep() {
    this.isCalibrating = false;
    if (this.quantumSynth) this.quantumSynth.releaseAll();
}

    async saveCalibration(name, mask) {
    try {
        const response = await fetch('/api/calibration/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mask })
        });
        return response.ok;
    } catch (e) {
        console.error("Failed to save calibration:", e);
        return false;
    }
}

    async loadCalibration(name, micManager) {
    try {
        const response = await fetch(`/api/calibration/get/${name}`);
        if (response.ok) {
            const data = await response.json();
            micManager.setStoredMask(data.mask);
            return true;
        }
    } catch (e) {
        console.error("Failed to load calibration:", e);
    }
    return false;
}

    async listCalibrations() {
    try {
        const response = await fetch('/api/calibration/list');
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error("Failed to list calibrations:", e);
    }
    return [];
}

cleanup() {
    this.stopAll();
    if (this.initialized && window.Tone) {
        Tone.Transport.stop();
        this.masterGain.dispose();
        this.limiter.dispose();
        this.reverb.dispose();
        this.quantumSynth.dispose();
        this.crossfader.dispose();
        this.playerA.dispose();
        this.playerB.dispose();
        this.initialized = false;
    }
}
}
