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

        // Calibration & Masking
        this.calibrationMode = false;
        this.calibrationMask = null; // Buffer of max magnitudes [0-255]
        this.tempMask = null;        // Used during active calibration sweep
    }

    async getDevices() {
        if (!navigator.mediaDevices) {
            console.error('Error: navigator.mediaDevices is undefined. \nThis usually happens because the site is not running in a Secure Context (localhost or HTTPS). \nPlease use http://localhost:8050 instead of an IP address.');
            return [];
        }
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error listing devices:', error);
            return [];
        }
    }

    async init(deviceId = null) {
        if (!navigator.mediaDevices) {
            console.error('Error: navigator.mediaDevices is undefined. Cannot access microphone. Use http://localhost:8050');
            this.enabled = false;
            return;
        }
        if (this.audioContext) {
            await this.stop();
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 44100,
            });

            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    channelCount: { ideal: 1 },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            const source = this.audioContext.createMediaStreamSource(this.stream);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512; // Higher resolution for better masking
            this.analyser.smoothingTimeConstant = 0.2; // Faster response for calibration
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            this.source = source;
            source.connect(this.analyser);

            this.enabled = true;
            console.log('MicManager initialized in FFT mode');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.enabled = false;
        }
    }

    startCalibration() {
        this.calibrationMode = true;
        this.tempMask = new Uint8Array(this.analyser.frequencyBinCount).fill(0);
        console.log("[MicManager] Calibration started...");
    }

    stopCalibration() {
        this.calibrationMode = false;
        if (this.tempMask) {
            this.calibrationMask = new Uint8Array(this.tempMask);
            this.tempMask = null;
        }
        console.log("[MicManager] Calibration finished. Mask captured.");
        return this.calibrationMask ? Array.from(this.calibrationMask) : [];
    }

    abortCalibration() {
        this.calibrationMode = false;
        this.tempMask = null;
        console.log("[MicManager] Calibration aborted.");
    }

    setStoredMask(maskArray) {
        if (maskArray && maskArray.length === this.analyser.frequencyBinCount) {
            this.calibrationMask = new Uint8Array(maskArray);
            console.log("[MicManager] Applied stored calibration mask.");
        }
    }

    update() {
        if (!this.enabled || !this.analyser) return;

        // Use Frequency Domain (FFT) instead of Time Domain (RMS)
        this.analyser.getByteFrequencyData(this.dataArray);

        if (this.calibrationMode && this.tempMask) {
            // Keep the peaks of everything we hear during calibration
            for (let i = 0; i < this.dataArray.length; i++) {
                if (this.dataArray[i] > this.tempMask[i]) {
                    this.tempMask[i] = this.dataArray[i];
                }
            }
        }

        let totalEnergy = 0;
        let count = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            let magnitude = this.dataArray[i];

            // Apply Masking: Subtract the room fingerprint
            if (this.calibrationMask && !this.calibrationMode) {
                // We subtract the mask and add a small safety margin (buffer)
                // A higher margin means more aggressive noise cancellation
                const margin = 10;
                magnitude = Math.max(0, magnitude - (this.calibrationMask[i] + margin));
            }

            // Square it for "energy-like" distribution
            totalEnergy += (magnitude / 255) * (magnitude / 255);
            count++;
        }

        const instantEnergy = Math.sqrt(totalEnergy / count);

        // Smoothing
        this.energy = this.energy * 0.7 + (instantEnergy * 5.0) * 0.3;
        if (this.energy > 1.0) this.energy = 1.0;
    }

    getEnergy() {
        return this.energy;
    }

    getSource() {
        return this.source;
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.enabled = false;
    }
}
