const noiseFunc = `
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
`;

export const plasmaVertexShader = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const plasmaFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    
    ${noiseFunc}
    
    void main() {
        vec2 uv = vUv;
        
        float noise1 = snoise(uv * 3.0 + uTime * 0.3);
        float noise2 = snoise(uv * 5.0 - uTime * 0.2);
        
        float plasma = sin(uv.x * 10.0 + noise1 * 3.0 + uTime) * 
                       cos(uv.y * 10.0 + noise2 * 3.0 + uTime);
        
        plasma = (plasma + 1.0) * 0.5;
        plasma = pow(plasma, 1.5);
        
        vec3 color1 = vec3(0.0, 0.5, 1.0);
        vec3 color2 = vec3(1.0, 0.1, 0.7);
        vec3 color3 = vec3(0.0, 1.0, 0.8);
        
        vec3 color = mix(color1, color2, plasma);
        color = mix(color, color3, noise1 * 0.5 + 0.5);
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

export const qubitVertexShader = `
    uniform float uTime;
    uniform float uEntanglement;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    // Simplex 3D Noise 
    // (Included via string interpolation in fragment but we need it here too, repeating for simplicity or move to common)
    // For Vertex Shader specifically:
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float cnoise(vec3 P) {
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod289(Pi0);
        Pi1 = mod289(Pi1);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.y, Pi0.y, Pi1.y, Pi1.y);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 * (1.0 / 7.0);
        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 * (1.0 / 7.0);
        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
    }

    void main() {
        vNormal = normalize(normalMatrix * normal);
        
        vec3 pos = position;
        
        // Entanglement Resonance: Vibrate vertices
        if (uEntanglement > 0.01) {
            float noiseVal = cnoise(pos * 2.0 + uTime * 5.0);
            float displacement = noiseVal * uEntanglement * 0.3; // Amplitude
            pos += normal * displacement;
        }
        
        vPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

export const qubitFragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uCoherence;
    uniform sampler2D uPlasmaTexture;
    uniform float uPlasmaEnabled;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    ${noiseFunc}
    
    void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
        
        vec3 finalColor;
        
        if (uPlasmaEnabled > 0.5) {
            vec3 pos = normalize(vPosition);
            vec2 uv = vec2(
                atan(pos.z, pos.x) / (2.0 * 3.14159) + 0.5,
                asin(pos.y) / 3.14159 + 0.5
            );
            
            float noise = snoise(uv * 5.0 + uTime * 0.3);
            uv.x += noise * sin(uTime * 0.7) * 0.05;
            uv.y += noise * cos(uTime * 0.7) * 0.05;
            
            vec4 plasmaColor = texture2D(uPlasmaTexture, uv);
            finalColor = uColor * plasmaColor.rgb * 2.5 * (1.0 + fresnel);
        } else {
            finalColor = uColor * (1.0 + fresnel * 0.5);
        }
        
        float alpha = (0.9 + fresnel * 0.1) * uCoherence;
        
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

export const orbitalVertexShader = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const orbitalFragmentShader = `
    uniform float uTime;
    uniform float uCoherence;
    uniform vec2 resolution;
    uniform vec3 uEntangledColors[3];
    uniform float uEntangled[3];
    uniform vec2 uBlobPos[3];
    uniform float uRandomSeed;
    varying vec2 vUv;
    
    void main() {
        vec2 r = resolution;
        float t = uTime * 1.5 + uRandomSeed;
        vec4 o = vec4(0.0);
        vec2 FC = vUv * r;
        
        vec2 p = (FC * 2.0 - r) / r.y;
        vec2 l = vec2(0.0);
        l += abs(0.7 - dot(p, p));
        vec2 v = p * (1.0 - l) / (0.2 + uRandomSeed * 0.05);
        
        for(float i = 1.0; i <= 8.0; i++) {
            v += cos(v.yx * i + vec2(uRandomSeed * 0.5, i) + t) / i + 0.7;
            o += (sin(vec4(v.x, v.y, v.y, v.x) + uRandomSeed) + 1.0) * abs(v.x - v.y) * 0.2;
        }
        
        o = tanh(exp(p.y * vec4(1.0, -1.0, -2.0, 0.0)) * exp(-4.0 * l.x) / o);
        
        vec2 centered = vUv - 0.5;
        if(length(centered) > 0.5) discard;
        
        float plasmaIntensity = (o.r + o.g + o.b) / 3.0;
        plasmaIntensity = pow(plasmaIntensity, 0.8) * 1.2;
        plasmaIntensity = smoothstep(0.4, 0.7, plasmaIntensity);
        vec3 baseColor = vec3(plasmaIntensity);
        
        for(int i = 0; i < 3; i++) {
            if(uEntangled[i] > 0.5) {
                float dist = distance(vUv, uBlobPos[i]);
                float blob = smoothstep(0.45, 0.0, dist);
                blob = pow(blob, 0.6);
                baseColor = mix(baseColor, uEntangledColors[i] * plasmaIntensity, blob * 0.8);
            }
        }
        
        baseColor = baseColor;
        
        gl_FragColor = vec4(baseColor * uCoherence, uCoherence * 0.6);
    }
`;
