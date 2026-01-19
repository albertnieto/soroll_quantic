export const particleVertexShader = `
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
            
            // State center
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
            float attraction = mag * exp(-d * 0.2); // Long range
            
            targetPos += stateCenter * attraction;
            totalWeight += attraction;
        }
        
        if (totalWeight > 0.0) {
            targetPos /= totalWeight;
            // Lerp towards target based on randomness - some particles follow physics, some wander
            pos = mix(pos, targetPos, 0.05 * sin(time + aRandom.x * 10.0));
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

export const particleFragmentShader = `
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
