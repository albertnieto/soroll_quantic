export class MicManager {
    constructor(numChannels = 4) {
        this.numChannels = numChannels;
        this.audioContext = null;
        this.stream = null;
        this.analysers = [];
        this.dataArrays = [];
        this.energies = new Array(numChannels).fill(0);
        this.enabled = false;
    }

    async init() {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Request 4-channel audio if possible
            const constraints = {
                audio: {
                    channelCount: this.numChannels,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            const source = this.audioContext.createMediaStreamSource(this.stream);

            const splitter = this.audioContext.createChannelSplitter(this.numChannels);
            source.connect(splitter);

            for (let i = 0; i < this.numChannels; i++) {
                const analyser = this.audioContext.createAnalyser();
                analyser.fftSize = 256;
                splitter.connect(analyser, i);

                this.analysers.push(analyser);
                this.dataArrays.push(new Uint8Array(analyser.frequencyBinCount));
            }

            this.enabled = true;
            console.log(`MicManager initialized with ${this.numChannels} channels`);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.enabled = false;
        }
    }

    update() {
        if (!this.enabled) return;

        for (let i = 0; i < this.numChannels; i++) {
            this.analysers[i].getByteTimeDomainData(this.dataArrays[i]);

            // Calculate RMS energy
            let sum = 0;
            for (let j = 0; j < this.dataArrays[i].length; j++) {
                const val = (this.dataArrays[i][j] - 128) / 128;
                sum += val * val;
            }
            const rms = Math.sqrt(sum / this.dataArrays[i].length);

            // Smoothing
            this.energies[i] = this.energies[i] * 0.7 + rms * 3.0 * 0.3;
            if (this.energies[i] > 1.0) this.energies[i] = 1.0;
        }
    }

    getEnergy(index) {
        return this.energies[index] || 0;
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
