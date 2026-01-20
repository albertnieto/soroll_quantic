// OLD ENTAGLEMENT SHADER (COMMENTED OUT / RENAMED FOR REFERENCE)
// -----------------------------------------------------------------
const old_particleVertexShader = `
    uniform float uTime;
    uniform float uStateVector[32]; // 16 complex amplitudes
    uniform vec3 uPositions[4]; // Qubit positions
    attribute float aSize;
    attribute vec3 aRandom; // Random seed per particle
    
    varying vec3 vColor;
    varying float vAlpha;
    
    // Simple pseudo-random function
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
        vec3 pos = position;
        
        // Dynamic Movement: "Wandering" flow
        // Each particle moves based on a flow field influenced by the quantum state
        
        float time = uTime * 0.2;
        
        // Base movement: Orbital rotation around center 
        float angle = atan(pos.z, pos.x);
        float dist = length(pos.xz);
        
        // Add curl noise-like movement
        pos.x += sin(pos.y * 0.5 + time) * 0.1;
        pos.z += cos(pos.y * 0.5 + time) * 0.1;
        
        // State Influence: Pull towards active qubits based on probability
        vec3 targetPos = vec3(0.0);
        float totalWeight = 0.0;
        
        for(int n = 0; n < 16; n++) {
            float real = uStateVector[n * 2];
            float imag = uStateVector[n * 2 + 1];
            float mag = sqrt(real * real + imag * imag);
            
            if(mag < 0.01) continue;
            
            // Special handling for Ground State |0000> to avoid Center Hotspot
            if (n == 0) {
                 // Ground state has NO spatial center. It acts as global ambient energy.
                 // We add to totalWeight uniformly so particles are visible but not clustered/bright at origin.
                 totalWeight += mag * 0.2; 
                 continue;
            }
            
            // State center calculation for excited states
            vec3 stateCenter = vec3(0.0);
            int count = 0;
            for(int q=0; q<4; q++) {
                if( ((n >> q) & 1) == 1 ) {
                    stateCenter += uPositions[q];
                    count++;
                }
            }
            if(count > 0) stateCenter /= float(count);
            
            // Weighted attraction
            float d = distance(pos, stateCenter);
            float attraction = mag * exp(-d * 0.2); 
            
            targetPos += stateCenter * attraction;
            totalWeight += attraction;
        }
        
        if (totalWeight > 0.0) {
            targetPos /= totalWeight;
            // Lerp towards target based on randomness - some particles follow physics, some wander
            // pos = mix(pos, targetPos, 0.05 * sin(time + aRandom.x * 10.0));
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Size proportional to local density/importance
        gl_PointSize = (1.0 + totalWeight * 5.0) * (30.0 / -mvPosition.z);
        
        // Color: Quantum spectrum
        // Map complex phase of dominant state to color?
        // Or just use position based coloration
        
        vec3 color1 = vec3(0.1, 0.4, 0.8); // Blue
        vec3 color2 = vec3(0.8, 0.2, 0.5); // Pink
        
        float t = sin(uTime * 0.5 + aRandom.y * 6.28) * 0.5 + 0.5;
        vec3 baseColor = mix(color1, color2, t);
        
        // Brighten if near active state
        baseColor += vec3(totalWeight * 0.5);
        
        vColor = baseColor;
        vAlpha = 0.6 + totalWeight * 0.4;
    }
`;

const old_particleFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float r = length(uv);
        if (r > 0.5) discard;
        
        float glow = 1.0 - (r * 2.0);
        glow = pow(glow, 2.0);
        
        gl_FragColor = vec4(vColor, vAlpha * glow);
    }
`;

// NEW ENTANGLEMENT SHADER PLACEHOLDERS
// -----------------------------------------------------------------

export const particleVertexShader = `
    uniform float uTime;
    uniform float uStateVector[32]; // 16 complex amplitudes
    uniform vec3 uPositions[4]; // Qubit positions
    attribute vec3 aRandom;
    attribute float aSize;
    
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
        vec3 pos = position;
        
        float time = uTime * 0.5;
        float rippleSpeed = 1.0;
        float rippleFreq = 0.3;
        
        // 1. Subtle "Wandering" / Idle Movement
        // Lateral displacement based on X position to create a "breathing" cylinder
        float wave = sin(pos.x * rippleFreq + time * rippleSpeed + aRandom.x * 6.28);
        pos.y += wave * 0.2;
        pos.z += cos(pos.x * rippleFreq + time * rippleSpeed + aRandom.y * 6.28) * 0.2;
        
        // 2. Quantum Interaction (Ripples)
        // Calculate influence from qubits (simplified)
        float totalInfluence = 0.0;
        for(int i = 0; i < 4; i++) {
            // Check if qubit is active in state (very rough approx)
            // Just use uStateVector[0] as a global "activity" factor for simplicity here
            // or better, check if any entangled amplitudes are high.
            float activity = 0.0;
            // Let's just use the ground state amplitude as inverse activity
            float groundProb = uStateVector[0] * uStateVector[0] + uStateVector[1] * uStateVector[1];
            float excit = 1.0 - groundProb;
            
            float d = distance(pos, uPositions[i]);
            float influence = excit * exp(-d * 0.3);
            totalInfluence += influence;
        }
        
        // Rippling expansion near active qubits
        pos.yz *= (1.0 + totalInfluence * sin(time * 3.0 + pos.x) * 0.1);
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Dynamic Size
        gl_PointSize = (1.5 + aSize * 2.0 + totalInfluence * 3.0) * (20.0 / -mvPosition.z);
        
        // Colors
        vec3 blue = vec3(0.0, 0.5, 1.0);
        vec3 cyan = vec3(0.0, 1.0, 0.8);
        vColor = mix(blue, cyan, aRandom.z + totalInfluence * 0.5);
        
        // Alpha fades with distance and randomness
        vAlpha = 0.3 + aRandom.y * 0.3 + totalInfluence * 0.4;
    }
`;

export const particleFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    
    void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        
        // Soft radial glow
        float glow = 1.0 - (dist * 2.0);
        glow = pow(glow, 3.0);
        
        gl_FragColor = vec4(vColor, vAlpha * glow);
    }
`;
