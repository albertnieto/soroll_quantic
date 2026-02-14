export class MicManager {
    constructor() {
        this.numChannels = 1;
        this.audioContext = null;
        this.stream = null;
        this.analyser = null;
        this.dataArray = null;
        this.energy = 0;
        this.enabled = false;
        this.source = null;

        // Sticky Adaptive Floor (Long-term preference)
        // We want to ignore constant noise but react to peaks.
        this.noiseFloor = 0.05;
        this.noiseGate = 0.005;
        this.sensitivity = 5.0;    // Boosted sensitivity for subtle peaks
    }

    async getDevices() {
        if (!navigator.mediaDevices) return [];
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error listing devices:', error);
            return [];
        }
    }

    async init(deviceId = null) {
        if (this.audioContext) await this.stop();

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.source.connect(this.analyser);

            this.enabled = true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.enabled = false;
        }
    }

    update() {
        if (!this.enabled || !this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);

        // 1. Calculate Instant Energy
        let total = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            total += this.dataArray[i] / 255;
        }
        const instantEnergy = total / this.dataArray.length;

        // 2. Asymmetrical Heavy Mean
        // We want to favor the "Long History" permanent sound.
        let followRate = 0.0005; // Standard slow follow

        if (instantEnergy > this.noiseFloor) {
            // If the sound is LOUDER than the floor (e.g. someone talking),
            // adapt EXTREMELY slowly. We don't want the floor to "eat" the conversation.
            followRate = 0.0001;
        } else {
            // If the room gets quieter, follow it a bit faster to find the new true floor.
            followRate = 0.002;
        }

        this.noiseFloor = this.noiseFloor * (1 - followRate) + instantEnergy * followRate;

        // 3. Peak Detection (Relative to the permanent floor)
        let delta = instantEnergy - (this.noiseFloor + this.noiseGate);

        if (delta > 0) {
            // We found a peak relative to the long-term background noise
            this.energy = delta * this.sensitivity;
        } else {
            // Fade out activation smoothly
            this.energy *= 0.85;
            if (this.energy < 0.001) this.energy = 0;
        }

        if (this.energy > 1.0) this.energy = 1.0;
    }

    getEnergy() {
        return this.energy;
    }

    async stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            if (this.audioContext.state !== 'closed') {
                await this.audioContext.close();
            }
            this.audioContext = null;
        }
        this.enabled = false;
    }
}
