import * as THREE from 'three';

export const blackHoleBillboardVertexShader = `
    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    
    void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const blackHoleBillboardFragmentShader = `
    uniform float uTime;
    uniform float uBlackHoleStrength;
    uniform float uAccretionEnabled;
    uniform float uLensingEnabled;
    uniform float uEinsteinEnabled;
    uniform float uBloomEnabled;
    uniform vec3 uCameraPos; // World space camera pos
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition; // Camera space position of the billboard pixel

    // Noise (Compact)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+10.0)*x); }
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    // Simplified Ray-Tracing for Schwarzschild Black Hole
    // We assume the billboard is centered on the black hole.
    // Screen coords -> Ray -> Intersection with Disc Plane -> Color
    
    void main() {
        if (uBlackHoleStrength < 0.01) discard;
        
        vec2 uv = vUv - 0.5;
        float dist = length(uv);
        
        // --- 1. Event Horizon / Shadow ---
        // The photon sphere is at 1.5Rs, Event Horizon at 1.0Rs.
        // In billboard UV space (0 to 1), let's say the BH radius is roughly 0.15
        float shadowRadius = 0.15;
        
        vec3 viewDir = normalize(vWorldPosition - uCameraPos);
        
        // This is a billboard, so we are looking at a 2D slice "near" the BH.
        // To simulate the "Interstellar" warped disc, we calculate the impact parameter b
        // b = distance of ray from center at infinity. For billboard, it's roughly proportional to UV distance.
        float impactB = dist * 10.0; // Scale UV to Schwarzschild radii units
        
        // Color accumulation
        vec3 color = vec3(0.0);
        float alpha = 0.0;
        
        // --- 2. Accretion Disc (Warped) ---
        if (uAccretionEnabled > 0.5) {
            // Simplified "Lookup": The disc is at the equator.
            // Light bends. Ray that looks "up" (uv.y > 0) might bend down and hit the disc behind the hole.
            
            // We model the visual appearance of the warped disc directly in screen space for performance
            // Top half: calculates back of disc. Bottom half: front of disc.
            
            // Tilt for perspective (simulated)
            float tilt = 0.5; // Radians
            
            // Effect: As b decreases (closer to hole), the light bends more.
            // We map the screen coordinate (uv) to a disc coordinate (polar r, phi).
            
            // Simple approach: Inverse mapping
            // R_disc approx = ... math ...
            // Let's use a visual approximation:
            // "Einstein Ring" at b = 5.2 (approx photon sphere projected)
            
            float ringDist = 0.25; // Visual radius of the ring on billboard
            
            // Is this ray hitting the "Front" Disc?
            // Front disc looks like a flattened oval.
            float yTilt = uv.y * 2.0; 
            float r_front = sqrt(uv.x * uv.x + yTilt * yTilt);
            
            // Is this ray hitting the "Back" Disc (warped over top)?
            // It appears as a rainbow-like arch over the shadow.
            // If uv.y > 0 and close to shadow.
            
            bool hit = false;
            float diskR = 0.0;
            float diskAngle = 0.0;
            float intensity = 0.0;
            
            // Check Front Disc Intersection
            // Tighten the range significantly: 0.16 roughly matches qubit surface (2/12 = 0.166)
            // User wants "few pixels from surface".
            // Let's set max radius to 0.25 (was 0.5)
            if (r_front > 0.165 && r_front < 0.3) {
                // Flattening check for "Front" part roughly
                if (uv.y < 0.1) { // Bottom half predominantly
                   hit = true;
                   diskR = r_front;
                   diskAngle = atan(yTilt, uv.x);
                   intensity = 1.0;
                }
            }
            
            // Check Back Disc (Warped Top)
            // It forms a circle/ring around the Shadow
            // Slightly tighter ring
            float r_circle = length(uv);
            if (r_circle > 0.17 && r_circle < 0.21) { // Just outside shadow
                hit = true;
                diskR = (r_circle - 0.17) * 40.0; // Map to texture radius (tighter mapping)
                diskAngle = atan(uv.y, uv.x) + 3.14; // Rotate texture
                intensity = 1.5; // Brighter (lensing amp)
            }
            
            if (hit) {
                // Sample Noise Texture logic
                float t = uTime * 2.0;
                float rot = diskAngle + 10.0 / (diskR + 0.1) - t; // Differential rotation
                
                float n = snoise(vec2(rot, diskR * 10.0));
                float n2 = snoise(vec2(rot * 2.0 - t, diskR * 20.0));
                
                // Color ramp
                float doppler = sin(diskAngle); // Red/Blue shift
                vec3 cBase = mix(vec3(1.0, 0.4, 0.1), vec3(0.2, 0.6, 1.0), doppler * 0.4 + 0.5);
                
                // Soft edges - adjusted for narrower band
                // Smoothstep based on relative position within the band
                float edgeFade = 1.0; 
                if (r_circle > 0.1) {
                    // Back disc fade
                     edgeFade = smoothstep(0.17, 0.18, r_circle) * smoothstep(0.21, 0.2, r_circle);
                } else {
                    // Front disc fade
                     edgeFade = smoothstep(0.165, 0.18, r_front) * smoothstep(0.3, 0.25, r_front);
                }
                
                color += cBase * intensity * (0.8 + n * 0.3 + n2 * 0.2) * edgeFade;
                alpha += intensity * edgeFade;
            }
        }
        
        // --- 3. Einstein Ring (Lensing of background stars) ---
        if (uEinsteinEnabled > 0.5) {
            float r = length(uv);
            // Sharp ring at ~0.2
            float width = 0.005;
            float ringInfo = smoothstep(width, 0.0, abs(r - 0.2));
            color += vec3(1.0, 0.9, 0.8) * ringInfo * 4.0;
            alpha += ringInfo;
        }

        // --- 4. Shadow (Event Horizon) ---
        // --- 4. Shadow (Event Horizon) ---
        // User requested NO black sphere. The central Qubit must be visible.
        // So we leave the center transparent (alpha 0) or simple passthrough.
        if (dist < 0.15) {
             // color = vec3(0.0); 
             // alpha = 1.0; 
             // Do nothing (keep whatever alpha was accumulated, likely 0 or low from lensing)
        }
        
        // Bloom
        if (uBloomEnabled > 0.5) color *= 1.2;
        
        // Soft outer edge of billboard to blend
        alpha *= smoothstep(0.5, 0.4, dist);

        gl_FragColor = vec4(color, alpha * uBlackHoleStrength);
    }
`;

export const lensingFsQuadShader = {
    uniforms: {
        tDiffuse: { value: null },
        uBHCenters: { value: [new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0.5, 0.5)] },
        uBHRadii: { value: [0.1, 0.1, 0.1, 0.1] }, // New: Screen space radii
        uBHStrengths: { value: [0.0, 0.0, 0.0, 0.0] }, // 0 to 1
        uLensingEnabled: { value: 1.0 },
        uResolution: { value: new THREE.Vector2(1.0, 1.0) } // Screen aspect ratio fix
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uBHCenters[4]; // Screen coordinates (0..1)
        uniform float uBHRadii[4];  // New: Screen radii
        uniform float uBHStrengths[4];
        uniform float uLensingEnabled;
        uniform vec2 uResolution; // aspect ratio correction: (width/height, 1.0) or (1.0, height/width)

        varying vec2 vUv;

        void main() {
            if (uLensingEnabled < 0.5) {
                gl_FragColor = texture2D(tDiffuse, vUv);
                return;
            }

            vec2 finalUv = vUv;
            vec2 displacement = vec2(0.0);
            
            // Iterate over all possible 4 qubits
            for (int i = 0; i < 4; i++) {
                if (uBHStrengths[i] > 0.01) {
                    vec2 bhCenter = uBHCenters[i];
                    vec2 vecToBH = vUv - bhCenter;
                    
                    // Correct aspect ratio for distance calculation
                    // assuming resolution.x is aspect ratio (width/height)
                    vec2 aspectCorrectedVec = vecToBH * vec2(uResolution.x / uResolution.y, 1.0);
                    
                    float r = length(aspectCorrectedVec);
                    
                    // Simple "Pinch" Radial Distortion (pull inwards to simulate magnification of background)
                    // Gravity pulls light towards the mass.
                    // The image we see at 'r' comes from 'r + alpha' (alpha > 0).
                    // So we sample from vUv + displacement (displacement pointing AWAY from center).
                    // If we sample from further out, we are pulling the background IN.
                    
                    // Fine-tuning: Dynamic radius uBHRadii[i]
                    // We MUST mask the center so the Qubit itself is NOT distorted.
                    // Only distort the "ring" between radius and radius * 1.35.
                    
                    float rMin = uBHRadii[i];
                    float rMax = uBHRadii[i] * 1.35;
                    
                    if (r > rMin && r < rMax) {
                       // Reduced strength from 0.01 to 0.003 to fix "too augmented" look
                       float strength = uBHStrengths[i] * 0.003; 
                       
                       // 1. Radial Distortion (Lens)
                       vec2 radialDir = normalize(vecToBH);
                       displacement -= radialDir * (strength / (r + 0.01));
                       
                       // 2. Swirl/Twist Distortion (Frame Dragging Mimic)
                       // Calculate tangential vector (perpendicular to radial)
                       vec2 tangentDir = vec2(-radialDir.y, radialDir.x);
                       
                       // Swirl factor: stronger closer to the hole
                       // This mimics light wrapping around the photon sphere
                       float swirl = strength * 2.0; 
                       displacement += tangentDir * (swirl / (r + 0.01));
                    }
                }
            }
            
            gl_FragColor = texture2D(tDiffuse, vUv + displacement);
        }
    `
};
