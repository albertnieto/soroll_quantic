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
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const orbitalFragmentShader = `
    #define PI 3.14159265359
    uniform float uTime;
    uniform float uCoherence;
    uniform sampler2D uPlasmaTexture;
    uniform vec3 uOtherQubit0Pos;
    uniform vec3 uOtherQubit1Pos;
    uniform vec3 uOtherQubit2Pos;
    uniform vec3 uOtherQubit0Color;
    uniform vec3 uOtherQubit1Color;
    uniform vec3 uOtherQubit2Color;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    
    ${noiseFunc}
    
    void main() {
        vec3 pos = normalize(vPosition);
        vec2 uv = vec2(
            atan(pos.z, pos.x) / (2.0 * PI) + 0.5,
            asin(pos.y) / PI + 0.5
        );
        
        vec3 otherPositions[3];
        otherPositions[0] = normalize(uOtherQubit0Pos - vPosition);
        otherPositions[1] = normalize(uOtherQubit1Pos - vPosition);
        otherPositions[2] = normalize(uOtherQubit2Pos - vPosition);
        
        vec3 otherColors[3];
        otherColors[0] = uOtherQubit0Color;
        otherColors[1] = uOtherQubit1Color;
        otherColors[2] = uOtherQubit2Color;
        
        vec2 textureCoord = uv;
        vec3 portalColor = vec3(0.0);
        float totalEffect = 0.0;
        
        for (int i = 0; i < 3; i++) {
            float alignment = dot(pos, otherPositions[i]);
            float circle = smoothstep(0.3, 0.85, alignment);
            
            float phase = float(i) * PI * 0.66;
            textureCoord.x += mix(0.0, 1.0, circle * sin(uTime + phase));
            textureCoord.y += mix(0.0, 1.0, circle * cos(uTime + phase));
            
            float glow = pow(circle, 2.0);
            portalColor += otherColors[i] * glow * 2.0;
            totalEffect += circle;
        }
        
        float noise = snoise(uv * 10.0 + uTime * 0.5);
        textureCoord += noise * totalEffect * 0.2;
        
        vec4 plasmaColor = texture2D(uPlasmaTexture, textureCoord);
        
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
        
        vec3 finalColor = mix(plasmaColor.rgb * 0.5, portalColor, totalEffect * 0.9);
        finalColor += portalColor * 0.5;
        finalColor += plasmaColor.rgb * fresnel * 0.3;
        
        float alpha = (totalEffect * 0.8 + fresnel * 0.3 + 0.2) * uCoherence;
        
        gl_FragColor = vec4(finalColor, alpha);
    }
`;
