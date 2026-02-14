import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export class VolumetricLightMesh extends THREE.Mesh {
    constructor(size = 10, color = 0xffaa44) {
        // Geometry: Cone to bound the volume
        // Tip at 0, Height along -Z is convenient for SpotLight convention.
        // Let's stick to standard Cone (Y-up) then rotate geometry or mesh.
        // Let's make geometry explicitly along -Z for ease of math.
        const height = size * 6.0;
        const radius = size * 2.5;
        const geometry = new THREE.ConeGeometry(radius, height, 32, 1, true);

        // Transform Geometry so Tip is at (0,0,0) and axis is along -Z
        // Standard Cone: H/2 to -H/2 on Y.
        // Translate Tip (H/2) to 0. (0, -H/2, 0).
        geometry.translate(0, -height / 2, 0);
        // Rotate 90 X. Y -> -Z.
        geometry.rotateX(Math.PI / 2);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(color) },
                uNoiseTexture: { value: null },
                uDensity: { value: 0.0 }, // Visibility toggle
                uStrength: { value: 5.0 }, // Intensity multiplier
                uLocalCameraPos: { value: new THREE.Vector3() },
                uConeHeight: { value: height },
                uConeRadius: { value: radius },
                uNearFade: { value: 2.0 }, // Fade near camera
            },
            vertexShader: `
                varying vec3 vLocalPos;
                varying vec3 vWorldPos;
                
                void main() {
                    vLocalPos = position;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                precision highp float;
                precision highp sampler3D;

                varying vec3 vLocalPos;
                varying vec3 vWorldPos;

                uniform float uTime;
                uniform vec3 uColor;
                uniform sampler3D uNoiseTexture;
                uniform float uDensity;
                uniform float uStrength;
                uniform vec3 uLocalCameraPos;
                uniform float uConeHeight;
                uniform float uConeRadius;
                uniform float uNearFade;

                #define STEPS 20
                #define PI 3.14159265359

                void main() {
                    // Optimization
                    if (uDensity <= 0.001) discard;

                    // Ray setup in Local Space
                    // Ray start: Camera (in local space)
                    // Ray end: Center of fragment (vLocalPos)
                    vec3 ro = uLocalCameraPos;
                    vec3 rd = normalize(vLocalPos - uLocalCameraPos);
                    
                    // Max distance to march is distance to fragment
                    float distToFrag = distance(vLocalPos, uLocalCameraPos);
                    
                    float stepSize = distToFrag / float(STEPS);
                    
                    // Jitter / Dither to reduce banding
                    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
                    float t = stepSize * dither; 
                    
                    float totalDensity = 0.0;

                    for(int i = 0; i < STEPS; i++) {
                        if(t >= distToFrag) break;
                        
                        vec3 p = ro + rd * t;
                        
                        // Check Bounds
                        // 1. Z Bounds: 0 to -uConeHeight
                        // 2. Cone Radius: x^2 + y^2 < (ratio * z)^2
                        if(p.z < 0.0 && p.z > -uConeHeight) {
                            float r = length(p.xy);
                            float maxR = (uConeRadius / uConeHeight) * -p.z;
                            
                            if(r < maxR) {
                                // WE ARE INSIDE THE LIGHT VOLUME
                                
                                // === LIGHT SHAFT LOGIC ===
                                
                                // A. Radial Beams (The "God Ray" Look)
                                float angle = atan(p.y, p.x);
                                angle += uTime * 0.2; 
                                float beams = pow(0.5 + 0.5 * sin(angle * 12.0), 30.0); // Very sharp beams
                                
                                // B. Noise (Dust)
                                vec3 samplePos = p * 0.1;
                                samplePos.z -= uTime * 2.0; // Flow away from source
                                float noise = texture(uNoiseTexture, samplePos).r;
                                
                                // C. Attenuation / Masks
                                // Tip Mask: Force density to 0 near z=0 (Source)
                                // CRITICAL FIX for "Sphere" artifact
                                float tipDist = -p.z; // Positive distance from tip
                                float tipMask = smoothstep(0.0, 1.5, tipDist); 
                                
                                // Radial Softness
                                float edgeMask = smoothstep(maxR, maxR * 0.5, r);
                                
                                // Accumulate
                                float density = (beams + noise * 0.2) * tipMask * edgeMask;
                                totalDensity += density;
                            }
                        }
                        
                        t += stepSize;
                    }
                    
                    // Optical depth approximation
                    float finalAlpha = totalDensity * stepSize * uDensity * uStrength * 0.1; 
                    
                    gl_FragColor = vec4(uColor, finalAlpha);
                }
            `,
            side: THREE.BackSide, // Render volume bounds
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false, // Transparent volume
        });

        super(geometry, material);

        this.initTexture();
    }

    initTexture() {
        const size = 64;
        const data = new Uint8Array(size * size * size);
        const perlin = new ImprovedNoise();
        const scale = 0.15;

        let i = 0;
        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const n = perlin.noise(x * scale, y * scale, z * scale);
                    data[i] = (128 + 128 * n);
                    i++;
                }
            }
        }

        const texture = new THREE.Data3DTexture(data, size, size, size);
        texture.format = THREE.RedFormat;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.wrapR = THREE.RepeatWrapping;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;

        this.material.uniforms.uNoiseTexture.value = texture;
    }

    update(time, camera) {
        this.material.uniforms.uTime.value = time;

        // Critical: Update Local Camera Position for Raymarching
        this.material.uniforms.uLocalCameraPos.value.copy(camera.position);
        this.worldToLocal(this.material.uniforms.uLocalCameraPos.value);
    }
}
