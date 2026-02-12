export class MicManager {
    constructor() {
        // We now treat the input as a SINGLE aggregated source
        this.numChannels = 1;
        this.audioContext = null;
        this.stream = null;
        this.analyser = null;
        this.dataArray = null;
        this.energy = 0;
        this.enabled = false;
        this.source = null;
    }

    async getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error listing devices:', error);
            return [];
        }
    }

    async init(deviceId = null) {
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
                    channelCount: { ideal: 1 }, // Just want mono mix
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            console.log('Requesting mic with constraints:', constraints);
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            const source = this.audioContext.createMediaStreamSource(this.stream);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.5;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            this.source = source;
            source.connect(this.analyser);

            this.enabled = true;
            console.log('MicManager initialized in MONO mode');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.enabled = false;
        }
    }

    update() {
        if (!this.enabled || !this.analyser) return;

        this.analyser.getByteTimeDomainData(this.dataArray);

        // Calculate RMS energy
        let sum = 0;
        for (let j = 0; j < this.dataArray.length; j++) {
            const val = (this.dataArray[j] - 128) / 128;
            sum += val * val;
        }
        const rms = Math.sqrt(sum / this.dataArray.length);

        // Smoothing
        this.energy = this.energy * 0.7 + rms * 3.0 * 0.3;
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
