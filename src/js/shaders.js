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
        
        vec3 color1 = vec3(0.1, 0.3, 0.8);
        vec3 color2 = vec3(0.8, 0.2, 0.5);
        vec3 color3 = vec3(0.2, 0.8, 0.6);
        
        vec3 color = mix(color1, color2, plasma);
        color = mix(color, color3, noise1 * 0.5 + 0.5);
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

export const qubitVertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const qubitFragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uCoherence;
    uniform sampler2D uPlasmaTexture;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    ${noiseFunc}
    
    void main() {
        vec3 pos = normalize(vPosition);
        vec2 uv = vec2(
            atan(pos.z, pos.x) / (2.0 * 3.14159) + 0.5,
            asin(pos.y) / 3.14159 + 0.5
        );
        
        float noise = snoise(uv * 5.0 + uTime * 0.3);
        uv.x += noise * sin(uTime * 0.7) * 0.05;
        uv.y += noise * cos(uTime * 0.7) * 0.05;
        
        vec4 plasmaColor = texture2D(uPlasmaTexture, uv);
        
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
        
        vec3 finalColor = uColor * plasmaColor.rgb * 1.5 * (1.0 + fresnel);
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
    varying vec2 vUv;
    
    void main() {
        vec2 r = resolution;
        float t = uTime * 1.5;
        vec4 o = vec4(0.0);
        vec2 FC = vUv * r;
        
        vec2 p = (FC * 2.0 - r) / r.y;
        vec2 l = vec2(0.0);
        l += abs(0.7 - dot(p, p));
        vec2 v = p * (1.0 - l) / 0.2;
        
        for(float i = 1.0; i <= 8.0; i++) {
            v += cos(v.yx * i + vec2(0.0, i) + t) / i + 0.7;
            o += (sin(vec4(v.x, v.y, v.y, v.x)) + 1.0) * abs(v.x - v.y) * 0.2;
        }
        
        o = tanh(exp(p.y * vec4(1.0, -1.0, -2.0, 0.0)) * exp(-4.0 * l.x) / o);
        
        vec2 centered = vUv - 0.5;
        if(length(centered) > 0.5) discard;
        
        float plasmaIntensity = (o.r + o.g + o.b) / 3.0;
        vec3 baseColor = vec3(plasmaIntensity);
        vec3 colorOverlay = vec3(0.0);
        
        for(int i = 0; i < 3; i++) {
            if(uEntangled[i] > 0.5) {
                float dist = distance(vUv, uBlobPos[i]);
                float blob = smoothstep(0.45, 0.0, dist);
                blob = pow(blob, 0.6);
                colorOverlay += uEntangledColors[i] * blob;
            }
        }
        
        baseColor += colorOverlay;
        
        gl_FragColor = vec4(baseColor * uCoherence, uCoherence * 0.6);
    }
`;
