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

    async getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error listing devices:', error);
            return [];
        }
    }

    async init(deviceId = null, mappingMode = 'Direct') {
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
                    channelCount: { ideal: this.numChannels },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            console.log('Requesting mic with constraints:', constraints);
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            const track = this.stream.getAudioTracks()[0];
            const settings = track.getSettings();
            this.activeChannels = settings.channelCount;
            console.log('Microphone settings:', settings);

            if (settings.channelCount < this.numChannels) {
                console.warn(`Requested ${this.numChannels} channels but got ${settings.channelCount}. Each mic might not be independent.`);
            }

            const source = this.audioContext.createMediaStreamSource(this.stream);

            // We split into the AVAILABLE channels, then route them to the TARGET analysers
            const inputChannelCount = settings.channelCount;
            const splitter = this.audioContext.createChannelSplitter(inputChannelCount);
            source.connect(splitter);

            this.analysers = [];
            this.dataArrays = [];

            for (let i = 0; i < this.numChannels; i++) {
                const analyser = this.audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.5;

                let sourceChannel = i;

                // MAPPING LOGIC
                if (mappingMode === 'StereoPairs') {
                    // Q0 -> Ch0, Q1 -> Ch1, Q2 -> Ch0, Q3 -> Ch1
                    // Useful if we have 4 channels but duplicates (L/R/L/R)
                    sourceChannel = i % 2;
                } else if (mappingMode === 'Mirrored') {
                    // Q0 -> Ch0, Q1 -> Ch0, Q2 -> Ch1, Q3 -> Ch1
                    sourceChannel = Math.floor(i / 2) % 2;
                } else {
                    // Direct (1:1)
                    // If we have fewer input channels than target, wrap around
                    sourceChannel = i % inputChannelCount;
                }

                // Safety clamp
                if (sourceChannel >= inputChannelCount) sourceChannel = 0;

                splitter.connect(analyser, sourceChannel);

                this.analysers.push(analyser);
                this.dataArrays.push(new Uint8Array(analyser.frequencyBinCount));
            }

            this.enabled = true;
            console.log(`MicManager initialized with ${settings.channelCount} active channels`);
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
