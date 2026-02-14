import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
// import { GodraysPass } from './GodraysPass.js'; // [REMOVED] Causing WebGL errors
import { VolumetricLightMesh } from './VolumetricLightMesh.js'; // [NEW] Volumetric Mesh

console.log("%c GODRAYS VERSION 2000 LOADED - VOLUMETRIC ", "background: #00ffff; color: #000; font-weight: bold;");

import { Qubit } from './Qubit.js';
import { plasmaVertexShader, plasmaFragmentShader, qubitVertexShader, qubitFragmentShader } from './shaders.js';
import { particleVertexShader, particleFragmentShader } from './advanced_shaders.js';
import { blackHoleBillboardVertexShader, blackHoleBillboardFragmentShader, lensingFsQuadShader } from './black_hole_shader.js';
import { QuantumCircuit } from './quantum_circuit.js';
import { QuantumSound } from './quantum_sound.js';
import { MicManager } from './mic_manager.js';
import { createQuantumClouds } from './quantum_clouds.js';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);
scene.background = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true; // [NEW] Enable Shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas').appendChild(renderer.domElement);

// --- Godrays Light Source ---
// --- Godrays Light Source ---
// USER REQUEST: Behind a qubit, projecting light THROUGH it (Point Light for Starburst effect)
// Testing on Qubit 3 (Index 2) at approx (4.25, 0, 0)
const godraysLight = new THREE.PointLight(0xffaa44, 1.0, 100);
godraysLight.position.set(4.25, 0, -5); // Directly behind Qubit 3, closer
godraysLight.castShadow = true;
godraysLight.shadow.mapSize.width = 1024;
godraysLight.shadow.mapSize.height = 1024;
godraysLight.shadow.camera.near = 0.1;
godraysLight.shadow.camera.far = 100;
godraysLight.shadow.bias = -0.0001;
scene.add(godraysLight);
// PointLights do not have a target property.

// Use a helper to visualize light (Optional, for debugging)
// const helper = new THREE.CameraHelper( godraysLight.shadow.camera );
// scene.add( helper );

// [NEW] Volumetric Light Mesh (Persistent Godrays)
// Size: 50 (Width), Color: 0xffaa44
const qubitGodRays = [];
const qubitPositionsForRays = [
    new THREE.Vector3(-12.75, 0, -2), // Qubit 0 (Behind)
    new THREE.Vector3(-4.25, 0, -2),  // Qubit 1
    new THREE.Vector3(4.25, 0, -2),   // Qubit 2
    new THREE.Vector3(12.75, 0, -2)   // Qubit 3
];

qubitPositionsForRays.forEach((pos, i) => {
    // Cone: Size 2 (Radius), Height ~4.
    const mesh = new VolumetricLightMesh(3, 0xffaa44);
    mesh.position.copy(pos);
    mesh.material.uniforms.uDensity.value = 0.0;
    mesh.visible = false; // [NEW] Strictly invisible start
    scene.add(mesh);
    qubitGodRays.push(mesh);
});

// Animation Helper
function triggerGodRay(index, duration = 2.0, intensity = 2.0) {
    if (!qubitGodRays[index]) return;

    console.log(`Triggering God Ray for Qubit ${index}`);

    const mesh = qubitGodRays[index];
    if (mesh) mesh.visible = true; // Show on trigger

    const startTime = performance.now();

    const animateRay = () => {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1.0);

        // Emerge (Fast In) and Contract (Slow Out)
        let val = 0;
        if (progress < 0.1) { // Faster attack (10%)
            val = progress / 0.1;
            val = Math.pow(val, 0.5); // Ease Out Quad
        } else {
            const p = (progress - 0.1) / 0.9;
            val = 1.0 - p;
            val = Math.pow(val, 2.0); // Ease In Quad Decay
        }

        mesh.material.uniforms.uDensity.value = val * intensity;

        if (progress < 1.0) {
            requestAnimationFrame(animateRay);
        } else {
            mesh.material.uniforms.uDensity.value = 0.0;
            mesh.visible = false; // Hide after animation
        }
    };

    requestAnimationFrame(animateRay);
}

// --- Post Processing Setup ---
// Configure Composer to use Depth Texture (Required for Godrays)
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType
});
renderTarget.depthTexture = new THREE.DepthTexture();
renderTarget.depthTexture.format = THREE.DepthFormat;
renderTarget.depthTexture.type = THREE.UnsignedIntType;

const composer = new EffectComposer(renderer, renderTarget);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// [REMOVED] GodraysPass - Replaced by VolumetricLightMesh
// const godraysPass = new GodraysPass(...)

const lensingPass = new ShaderPass(lensingFsQuadShader);
lensingPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
lensingPass.uniforms.uBHRadii.value = [0.1, 0.1, 0.1, 0.1]; // Add this initialization
composer.addPass(lensingPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let qubitSpacing = 8.5;
const qubits = [];
const qubitMeshes = [];
// const godrayMeshes = []; // [REMOVED] Old billboard meshes
const qubitCloudMeshes = []; // Stores { state0, state1 } for each qubit
const particleSystem = { mesh: null, uniforms: null };
const quantumCircuit = new QuantumCircuit();
const quantumSound = new QuantumSound();
const micManager = new MicManager();

// Expose globally for console access
window.quantumSound = quantumSound;
window.micManager = micManager;

const plasmaTarget = new THREE.WebGLRenderTarget(1024, 1024);
const rtCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const rtScene = new THREE.Scene();

const plasmaGeometry = new THREE.PlaneGeometry(2, 2);
const plasmaMaterial = new THREE.ShaderMaterial({
    vertexShader: plasmaVertexShader,
    fragmentShader: plasmaFragmentShader,
    uniforms: {
        uTime: { value: 0 }
    }
});
const plasmaPlane = new THREE.Mesh(plasmaGeometry, plasmaMaterial);
rtScene.add(plasmaPlane);

function updateQubitPositions() {
    const positions = [
        new THREE.Vector3(-qubitSpacing * 1.5, 0, 0),
        new THREE.Vector3(-qubitSpacing * 0.5, 0, 0),
        new THREE.Vector3(qubitSpacing * 0.5, 0, 0),
        new THREE.Vector3(qubitSpacing * 1.5, 0, 0)
    ];

    qubitMeshes.forEach((mesh, i) => {
        mesh.position.copy(positions[i]);
        qubits[i].position = positions[i];
    });
}

function createParticleSystem() {
    // Volumetric particle cloud
    const particleCount = 50000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const initialState = new Float32Array(32);
    initialState[0] = 1.0;

    const qubitPosArray = [
        new THREE.Vector3(-12.75, 0, 0),
        new THREE.Vector3(-4.25, 0, 0),
        new THREE.Vector3(4.25, 0, 0),
        new THREE.Vector3(12.75, 0, 0)
    ];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 80.0; // X (was 32.0)
        const rCyl = 25.0 * Math.sqrt(Math.random());
        const theta = Math.random() * 2.0 * Math.PI;
        positions[i * 3 + 1] = rCyl * Math.cos(theta); // Y
        positions[i * 3 + 2] = rCyl * Math.sin(theta); // Z

        randoms[i * 3] = Math.random();
        randoms[i * 3 + 1] = Math.random();
        randoms[i * 3 + 2] = Math.random();
        sizes[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const uniforms = {
        uTime: { value: 0 },
        uStateVector: { value: initialState },
        uPositions: { value: qubitPosArray }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        uniforms: uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    particleSystem.mesh = points;
    particleSystem.uniforms = uniforms;
}

createParticleSystem();

// Pre-generate Cloud Prototypes (once, reusing geometry is efficient)
const cloudPrototypes = createQuantumClouds(5000);

function createQubitSphere(position, index) {
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const material = new THREE.ShaderMaterial({
        vertexShader: qubitVertexShader,
        fragmentShader: qubitFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0xffffff) },
            uCoherence: { value: 1.0 },
            uPlasmaTexture: { value: plasmaTarget.texture },
            uPlasmaEnabled: { value: 1.0 },
            uUse3DPlasma: { value: 1.0 }, // Default to Original 2D Mode
            uEntanglement: { value: 0.0 }
        },
        transparent: true,
        // Changed to NormalBlending so the Qubit occludes the background particles.
        // This solves "seeing particles in front and behind".
        blending: THREE.NormalBlending,
        depthWrite: true // CRITICAL: Must write depth for Godrays to be occluded!
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);

    const billboardGeometry = new THREE.PlaneGeometry(12, 12);
    const billboardMaterial = new THREE.ShaderMaterial({
        vertexShader: blackHoleBillboardVertexShader,
        fragmentShader: blackHoleBillboardFragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uBlackHoleStrength: { value: 0.0 },
            uAccretionEnabled: { value: 1.0 },
            uLensingEnabled: { value: 0.0 }, // Disabled on Billboard (moved to PP)
            uEinsteinEnabled: { value: 1.0 },
            uBloomEnabled: { value: 1.0 },
            uCameraPos: { value: new THREE.Vector3() }
        },
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false
    });

    const billboardMesh = new THREE.Mesh(billboardGeometry, billboardMaterial);
    billboardMesh.renderOrder = 999;

    mesh.add(billboardMesh);
    mesh.userData.billboardMesh = billboardMesh;

    mesh.layers.set(1); // Layer 1: Foreground (Qubits)
    // Ensure children (billboard) also inherit? Three.js usually requires explicit set for children if added later.
    // But mesh.add() usually propagates if set before? No, let's be explicit.
    mesh.traverse((child) => {
        child.layers.set(1);
    });

    mesh.castShadow = true; // [NEW] Cast Shadows for Godrays
    mesh.receiveShadow = true;

    scene.add(mesh);
    qubitMeshes.push(mesh);

    // --- Create Quantum Clouds for this Qubit ---
    const cloud0 = cloudPrototypes.meshState0.clone();
    const cloud1 = cloudPrototypes.meshState1.clone();

    // Independent materials for each qubit so we can control opacity individually
    cloud0.material = cloudPrototypes.meshState0.material.clone();
    cloud1.material = cloudPrototypes.meshState1.material.clone();

    cloud0.position.copy(position);
    cloud1.position.copy(position);

    // Initially hidden
    cloud0.visible = false;
    cloud1.visible = false;

    scene.add(cloud0);
    scene.add(cloud1);

    qubitCloudMeshes.push({ state0: cloud0, state1: cloud1 });

    // [REMOVED] Old Godray Billboards
}


const initialPositions = [
    new THREE.Vector3(-qubitSpacing * 1.5, 0, 0),
    new THREE.Vector3(-qubitSpacing * 0.5, 0, 0),
    new THREE.Vector3(qubitSpacing * 0.5, 0, 0),
    new THREE.Vector3(qubitSpacing * 1.5, 0, 0)
];

initialPositions.forEach((pos, i) => {
    const qubit = new Qubit(i, pos);
    qubit.alpha = 1;
    qubit.beta = 0;
    qubit.phase = 0;
    qubit.coherent = true;
    qubits.push(qubit);
    createQubitSphere(pos, i);
});

// Initialize Mic Random Target
window.micTargetIndex = 0;
window.lastMicTargetTime = 0;

let autoExecute = false;
let autoStepDelay = 1000;
let autoLoop = true;
let autoExecuteTimeout = null;

const autoSpeedSlider = document.getElementById('auto-speed');
autoSpeedSlider.addEventListener('input', (e) => {
    autoStepDelay = parseInt(e.target.value);
    document.getElementById('speed-value').textContent = (autoStepDelay / 1000).toFixed(1) + 's';
});

document.getElementById('toggle-loop').addEventListener('change', (e) => {
    autoLoop = e.target.checked;
});

function runAutoStep() {
    if (!autoExecute) return;

    const hasMore = executeNextGate();

    if (hasMore) {
        autoExecuteTimeout = setTimeout(runAutoStep, autoStepDelay);
    } else {
        if (autoLoop) {
            // Wait one extra beat before restarting
            autoExecuteTimeout = setTimeout(() => {
                if (autoExecute) {
                    executeNextGate(); // First gate of new cycle
                    autoExecuteTimeout = setTimeout(runAutoStep, autoStepDelay);
                }
            }, autoStepDelay);
        } else {
            autoExecute = false;
            document.getElementById('auto-execute').textContent = 'Auto Execute';
        }
    }
}

document.getElementById('auto-execute').addEventListener('click', () => {
    autoExecute = !autoExecute;
    document.getElementById('auto-execute').textContent = autoExecute ? 'Stop Auto' : 'Auto Execute';

    if (autoExecute) {
        runAutoStep();
    } else {
        clearTimeout(autoExecuteTimeout);
    }
});

let currentMode = 'manual';

const circuitModeSelect = document.getElementById('circuit-mode');
circuitModeSelect.addEventListener('change', (e) => {
    currentMode = e.target.value;

    if (currentMode === '') {
        document.getElementById('manual-controls').style.display = 'none';
        document.getElementById('circuit-mode-controls').style.display = 'none';
    } else if (currentMode === 'manual') {
        document.getElementById('manual-controls').style.display = 'block';
        document.getElementById('circuit-mode-controls').style.display = 'none';
    } else {
        document.getElementById('manual-controls').style.display = 'none';
        document.getElementById('circuit-mode-controls').style.display = 'block';

        quantumCircuit.reset();
        quantumCircuit.loadCircuit(currentMode).then(() => {
            const img = document.getElementById('circuit-diagram-img');
            if (img) {
                img.src = `/circuits/${currentMode}_diagram.png?t=` + Date.now();
                img.style.display = 'block';
                img.onerror = () => {
                    img.style.display = 'none';
                };
            }
            document.getElementById('current-gate').textContent = 'No gate executed';
            document.getElementById('circuit-progress-bar').style.width = '0%';
            qubits.forEach(qubit => {
                qubit.alpha = 1;
                qubit.beta = 0;
                qubit.phase = 0;
                qubit.coherent = true;
                qubit.entangledWith = [];
            });
            updateQuantumStateDisplay();
        });
    }
});

scene.add(new THREE.AmbientLight(0x111111));

const micThresholds = [0, 0, 0, 0];
const THRESHOLD_LIMIT = 0.7;
const RIPPLE_THRESHOLD = 0.15;

const manualQubitsDiv = document.getElementById('manual-qubits');
for (let i = 0; i < 4; i++) {
    const div = document.createElement('div');
    div.className = 'manual-qubit';

    const entangleCheckboxes = [0, 1, 2, 3]
        .filter(j => j !== i)
        .map(j => `<label><input type="checkbox" id="entangle-${i}-${j}"> Q${j}</label>`)
        .join('');

    div.innerHTML = `
        <label>Qubit ${i}</label>
        <div style="font-size:9px;margin-bottom:2px;">Alpha (|0⟩)</div>
        <input type="range" id="manual-alpha${i}" min="0" max="100" value="100" step="1">
        <div class="value-display" id="alpha-value${i}">1.00</div>
        <div style="font-size:9px;margin-bottom:2px;margin-top:4px;">Phase</div>
        <input type="range" id="manual-phase${i}" min="0" max="628" value="0" step="1">
        <div class="value-display" id="phase-value${i}">0.00</div>
        <div class="entangle-checkboxes">
            <div style="margin-bottom:2px;">Entangle with:</div>
            ${entangleCheckboxes}
        </div>
    `;
    manualQubitsDiv.appendChild(div);

    document.getElementById(`manual-alpha${i}`).addEventListener('input', (e) => {
        const alpha = e.target.value / 100;
        const beta = Math.sqrt(1 - alpha * alpha);
        qubits[i].alpha = alpha;
        qubits[i].beta = beta;
        qubits[i].coherent = true;
        document.getElementById(`alpha-value${i}`).textContent = alpha.toFixed(2);
        updateQuantumStateDisplay();
    });

    document.getElementById(`manual-phase${i}`).addEventListener('input', (e) => {
        const phase = (e.target.value / 100);
        qubits[i].phase = phase;
        document.getElementById(`phase-value${i}`).textContent = phase.toFixed(2);
        updateQuantumStateDisplay();
    });

    [0, 1, 2, 3].filter(j => j !== i).forEach(j => {
        document.getElementById(`entangle-${i}-${j}`).addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!qubits[i].entangledWith.includes(j)) {
                    qubits[i].entangledWith.push(j);
                }
            } else {
                qubits[i].entangledWith = qubits[i].entangledWith.filter(q => q !== j);
            }
            updateQuantumStateDisplay();
        });
    });
}

const micControlsDiv = document.getElementById('mic-controls');
for (let i = 0; i < 4; i++) {
    const div = document.createElement('div');
    div.className = 'mic-control';
    div.innerHTML = `
        <h3>Mic ${i + 1} (Qubit ${i})</h3>
        <input type="range" id="mic${i}" min="0" max="100" value="0" step="1">
        <div class="value-display" id="value${i}">0.00</div>
        <div class="threshold-indicator" id="indicator${i}"></div>
    `;
    micControlsDiv.appendChild(div);

    const slider = div.querySelector(`#mic${i}`);
    slider.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        micThresholds[i] = value;
        document.getElementById(`value${i}`).textContent = value.toFixed(2);

        const indicator = document.getElementById(`indicator${i}`);
        indicator.style.width = (value * 100) + '%';

        if (value > THRESHOLD_LIMIT && qubits[i].coherent) {
            indicator.classList.add('breach');
            qubits[i].collapse(Math.random() > 0.5 ? 1 : 0);
            if (quantumSound.enabled) quantumSound.playCollapseSound();
        } else {
            indicator.classList.remove('breach');
        }
    });
}

function getQubitState(qubit) {
    const prob0 = qubit.getProbability0();
    const prob1 = qubit.getProbability1();

    if (!qubit.coherent) {
        return prob1 > 0.5 ? 'Collapsed |1⟩' : 'Collapsed |0⟩';
    } else if (Math.abs(prob0 - 1.0) < 0.01) {
        return 'Initialized |0⟩';
    } else if (Math.abs(prob1 - 1.0) < 0.01) {
        return 'Initialized |1⟩';
    } else if (qubit.entangledWith.length > 0) {
        return 'Entangled';
    } else {
        return 'Superposition';
    }
}

function updateQuantumStateDisplay() {
    const statesDiv = document.getElementById('qubit-states');
    statesDiv.innerHTML = '';

    qubits.forEach((qubit, i) => {
        const div = document.createElement('div');
        div.className = 'qubit-state';
        const prob0 = (qubit.getProbability0() * 100).toFixed(1);
        const prob1 = (qubit.getProbability1() * 100).toFixed(1);
        const state = getQubitState(qubit);
        const entangled = qubit.entangledWith.filter(j => {
            const otherQubit = qubits[j];
            return otherQubit.coherent && Math.abs(otherQubit.getProbability0() - 0.5) < 0.4;
        }).map(j => `Q${j}`).join(', ');

        div.innerHTML = `
            <div class="label">Qubit ${i}</div>
            <div class="value">|0⟩: ${prob0}% | |1⟩: ${prob1}%</div>
            <div class="value">Phase: ${(qubit.phase % (Math.PI * 2)).toFixed(2)}</div>
            <div class="value">State: ${state}</div>
            ${entangled ? `<div class="entanglement-info">Entangled: ${entangled}</div>` : ''}
        `;
        statesDiv.appendChild(div);
    });
}

function executeNextGate() {
    const gate = quantumCircuit.nextGate();
    if (gate) {
        document.getElementById('current-gate').textContent =
            `Gate: ${gate.type} on qubit(s) ${gate.wires.join(', ')}`;
        document.getElementById('circuit-progress-bar').style.width =
            (quantumCircuit.getProgress() * 100) + '%';

        if (gate.type === 'INIT') {
            gate.wires.forEach(wire => {
                qubits[wire].alpha = 1;
                qubits[wire].beta = 0;
                qubits[wire].phase = 0;
                qubits[wire].coherent = true;
                qubits[wire].entangledWith = []; // Clear entanglement on reset
            });
        } else if (gate.type === 'H') {
            gate.wires.forEach(wire => {
                qubits[wire].alpha = Math.cos(Math.PI / 4);
                qubits[wire].beta = Math.sin(Math.PI / 4);
                qubits[wire].coherent = true;
                qubits[wire].entangledWith = []; // Reset on new state
            });
        } else if (gate.type === 'CNOT') {
            const control = gate.wires[0];
            const target = gate.wires[1];
            // Bringing qubits back to life on interaction
            qubits[control].coherent = true;
            qubits[target].coherent = true;

            if (qubits[control].getProbability1() > 0.5) {
                const temp = qubits[target].alpha;
                qubits[target].alpha = qubits[target].beta;
                qubits[target].beta = temp;
            }
            if (!qubits[control].entangledWith.includes(target)) {
                qubits[control].entangledWith.push(target);
            }
            if (!qubits[target].entangledWith.includes(control)) {
                qubits[target].entangledWith.push(control);
            }
        } else if (gate.type === 'RY') {
            const angle = gate.params[0];
            gate.wires.forEach(wire => {
                qubits[wire].coherent = true;
                qubits[wire].entangledWith = [];
                const cos = Math.cos(angle / 2);
                const sin = Math.sin(angle / 2);
                const a = qubits[wire].alpha;
                const b = qubits[wire].beta;
                qubits[wire].alpha = cos * a - sin * b;
                qubits[wire].beta = sin * a + cos * b;
            });
        } else if (gate.type === 'RX') {
            const angle = gate.params[0];
            gate.wires.forEach(wire => {
                qubits[wire].coherent = true;
                qubits[wire].entangledWith = [];
                const cos = Math.cos(angle / 2);
                const sin = Math.sin(angle / 2);
                const a = qubits[wire].alpha;
                const b = qubits[wire].beta;
                qubits[wire].alpha = a * cos - b * sin;
                qubits[wire].beta = b * cos + a * sin;
            });
        } else if (gate.type === 'RZ') {
            const angle = gate.params[0];
            gate.wires.forEach(wire => {
                qubits[wire].coherent = true;
                qubits[wire].phase += angle;
            });
        }
        updateQuantumStateDisplay();
        if (quantumSound.enabled) quantumSound.playGateSound();
        return true;
    } else {
        quantumCircuit.reset();
        return false;
    }
}

document.getElementById('next-gate').addEventListener('click', () => {
    executeNextGate();
});

document.getElementById('reset-circuit').addEventListener('click', () => {
    quantumCircuit.reset();
    document.getElementById('current-gate').textContent = 'No gate executed';
    document.getElementById('circuit-progress-bar').style.width = '0%';
    qubits.forEach(qubit => {
        qubit.alpha = 1;
        qubit.beta = 0;
        qubit.phase = 0;
        qubit.coherent = true;
    });
    updateQuantumStateDisplay();
});

document.getElementById('reset').addEventListener('click', () => {
    qubits.forEach((qubit, i) => {
        qubit.alpha = Math.cos(Math.random() * Math.PI / 2);
        qubit.beta = Math.sin(Math.random() * Math.PI / 2);
        qubit.phase = Math.random() * Math.PI * 2;
        qubit.coherent = true;

        document.getElementById(`mic${i}`).value = 0;
        document.getElementById(`value${i}`).textContent = '0.00';
        document.getElementById(`indicator${i}`).style.width = '0%';
        document.getElementById(`indicator${i}`).classList.remove('breach');
        micThresholds[i] = 0;
    });
    updateQuantumStateDisplay();
});

let shadersEnabled = {
    plasma: true,
    qubit: true,
    clouds: false, // New mode
    orbital: true,
    entanglement: true,
    accretion: false, // Default false
    lensing: true,
    einstein: false, // Default false
    bloom: true,
    godrays: false // [NEW] Disabled by default
};

document.getElementById('toggle-plasma').addEventListener('change', (e) => {
    shadersEnabled.plasma = e.target.checked;
    qubitMeshes.forEach(mesh => {
        mesh.material.uniforms.uPlasmaEnabled.value = e.target.checked ? 1.0 : 0.0;
    });
});

document.getElementById('toggle-qubit').addEventListener('change', (e) => {
    shadersEnabled.qubit = e.target.checked;
    qubitMeshes.forEach(mesh => mesh.visible = e.target.checked);
});

document.getElementById('toggle-clouds').addEventListener('change', (e) => {
    shadersEnabled.clouds = e.target.checked;
});

['accretion', 'lensing', 'einstein', 'bloom'].forEach(key => {
    document.getElementById(`toggle-${key}`).addEventListener('change', (e) => {
        shadersEnabled[key] = e.target.checked;
    });
});

document.getElementById('toggle-seamless').addEventListener('change', (e) => {
    shadersEnabled.seamless = e.target.checked;
    qubitMeshes.forEach(mesh => {
        mesh.material.uniforms.uUse3DPlasma.value = e.target.checked ? 1.0 : 0.0;
    });
});

document.getElementById('toggle-entanglement').addEventListener('change', (e) => {
    shadersEnabled.entanglement = e.target.checked;
});

// [NEW] Godrays Toggle
document.getElementById('toggle-godrays').addEventListener('change', (e) => {
    shadersEnabled.godrays = e.target.checked;
    // No GodraysPass to toggle anymore
});

document.getElementById('toggle-orbital').addEventListener('change', (e) => {
    if (particleSystem.mesh) {
        particleSystem.mesh.visible = e.target.checked;
    }
});

document.getElementById('spacing').addEventListener('input', (e) => {
    qubitSpacing = parseFloat(e.target.value);
    document.getElementById('spacingValue').textContent = qubitSpacing.toFixed(1);
    updateQubitPositions();
});

function updateEdgeMask() {
    const intensity = document.getElementById('mask-intensity').value / 100;
    const size = document.getElementById('mask-size').value;
    const overlay = document.getElementById('edge-mask-overlay');
    // We use size as blur and half of size as spread for a soft natural vignette
    overlay.style.boxShadow = `inset 0 0 ${size}px ${size / 2}px rgba(0, 0, 0, ${intensity})`;
}

document.getElementById('mask-intensity').addEventListener('input', (e) => {
    document.getElementById('maskIntensityValue').textContent = e.target.value + '%';
    updateEdgeMask();
});

document.getElementById('mask-size').addEventListener('input', (e) => {
    document.getElementById('maskSizeValue').textContent = e.target.value + 'px';
    updateEdgeMask();
});

document.getElementById('toggle-edge-mask').addEventListener('change', (e) => {
    const overlay = document.getElementById('edge-mask-overlay');
    overlay.classList.toggle('hidden', !e.target.checked);
    document.getElementById('edge-mask-controls').style.display = e.target.checked ? 'block' : 'none';
});

// Initialize mask state
updateEdgeMask();

document.getElementById('start-sound').addEventListener('click', async (e) => {
    const enabled = await quantumSound.toggle();
    e.target.textContent = enabled ? 'Stop Quantum Sound' : 'Start Quantum Sound';
    e.target.style.background = enabled ? '#440022' : '#004444';
});

document.getElementById('sound-volume').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('volume-value').textContent = value + '%';
    quantumSound.setMasterVolume(value);
});

document.getElementById('ai-volume').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('ai-volume-value').textContent = value + '%';
    quantumSound.setAIVolume(value);
});

document.getElementById('quantum-volume').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('quantum-volume-value').textContent = value + '%';
    quantumSound.setQuantumVolume(value);
});

document.getElementById('sound-bass').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('bass-value').textContent = value + '%';
    quantumSound.setBassDepth(value);
});

document.getElementById('sound-resonance').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('resonance-value').textContent = value + '%';
    quantumSound.setResonance(value);
});

document.getElementById('gate-sound-style').addEventListener('change', (e) => {
    quantumSound.setStyle('gate', e.target.value);
});

document.getElementById('entanglement-style').addEventListener('change', (e) => {
    quantumSound.setStyle('entanglement', e.target.value);
});

document.getElementById('collapse-style').addEventListener('change', (e) => {
    quantumSound.setStyle('collapse', e.target.value);
});

// --- Tuning & Calibration Logic ---
// --- Real-Time Adaptive Acoustic Cancellation is now fully automated in the animation loop ---

async function refreshMicList() {
    const devices = await micManager.getDevices();
    const select = document.getElementById('mic-device');
    const currentValue = select.value;

    // Keep 'Default' as first option
    select.innerHTML = '<option value="">Default Device</option>';

    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${device.deviceId.slice(0, 5)}...`;
        select.appendChild(option);
    });

    if (currentValue) {
        select.value = currentValue;
    }
}


async function startMic() {
    const btn = document.getElementById('start-mic');

    if (micManager.enabled) {
        // STOP MIC
        await micManager.stop();
        btn.textContent = 'Start Live Mic';
        btn.style.background = '#004444';
        return;
    }

    // START MIC
    const deviceId = document.getElementById('mic-device').value;
    await micManager.init(deviceId);

    await refreshMicList();

    btn.textContent = micManager.enabled ? 'Stop Live Mic' : 'Retry Mic';
    btn.style.background = micManager.enabled ? '#770000' : '#440000';
}

document.getElementById('start-mic').addEventListener('click', startMic);

document.getElementById('mic-device').addEventListener('change', async () => {
    if (micManager.enabled) {
        await startMic();
    }
});



let uiVisible = true;
function toggleUI(visible) {
    uiVisible = visible !== undefined ? visible : !uiVisible;
    document.body.classList.toggle('ui-hidden', !uiVisible);
    document.getElementById('toggle-ui').textContent = uiVisible ? 'Hide UI' : 'Show UI';
}

document.getElementById('toggle-ui').addEventListener('click', () => {
    toggleUI(false);
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !uiVisible) {
        toggleUI(true);
    }
});

// Panel Toggle Logic
document.querySelectorAll('.panel-header').forEach(header => {
    header.addEventListener('click', () => {
        const panel = header.closest('.ui-panel');
        panel.classList.toggle('collapsed');
    });
});

let lightMode = false;
document.getElementById('toggle-theme').addEventListener('click', () => {
    lightMode = !lightMode;
    document.body.classList.toggle('light-mode', lightMode);
    document.getElementById('toggle-theme').textContent = lightMode ? 'Dark Mode' : 'Light Mode';
});

let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    let allCoherent = true;

    plasmaMaterial.uniforms.uTime.value = time;
    renderer.setRenderTarget(plasmaTarget);
    renderer.render(rtScene, rtCamera);
    renderer.setRenderTarget(null);

    const qubitColors = [];

    if (quantumCircuit.entangledPairs) {
        qubits.forEach(q => q.entangledWith = []);
        quantumCircuit.entangledPairs.forEach(pair => {
            qubits[pair[0]].entangledWith.push(pair[1]);
            qubits[pair[1]].entangledWith.push(pair[0]);
        });
    }

    const bhCenters = [];
    const bhStrengths = [];
    const bhRadii = [];

    qubits.forEach((qubit, i) => {
        if (!qubit.coherent) allCoherent = false;

        const mesh = qubitMeshes[i];
        const prob0 = qubit.getProbability0();
        const prob1 = qubit.getProbability1();

        let targetColor;
        if (!qubit.coherent) {
            targetColor = prob1 > 0.5 ? new THREE.Color(1, 1, 1) : new THREE.Color(0.15, 0.15, 0.15);
        } else {
            const brightness = 0.15 + prob1 * 0.85;
            const superposition = 4 * prob0 * prob1;
            const saturation = superposition * 0.8;
            const hue = qubit.phase / (Math.PI * 2);
            targetColor = new THREE.Color().setHSL(hue, saturation, brightness * 0.5);
        }

        const currentColor = mesh.material.uniforms.uColor.value;
        currentColor.lerp(targetColor, 0.1);

        qubitColors.push(currentColor.clone());

        mesh.material.uniforms.uTime.value = time + i;
        mesh.material.uniforms.uCoherence.value = qubit.coherent ? 1.0 : 0.3;

        // Update Billboard
        const bb = mesh.userData.billboardMesh;
        if (bb) {
            bb.lookAt(camera.position);
            bb.material.uniforms.uTime.value = time;
            bb.material.uniforms.uCameraPos.value.copy(camera.position);

            let targetBH = 0.0;
            if (qubit.coherent && qubit.entangledWith.length > 0) {
                targetBH = 1.0;
            }
            const currentBH = bb.material.uniforms.uBlackHoleStrength.value;
            const nextBH = currentBH + (targetBH - currentBH) * 0.05;
            bb.material.uniforms.uBlackHoleStrength.value = nextBH;

            bb.material.uniforms.uAccretionEnabled.value = shadersEnabled.accretion ? 1.0 : 0.0;
            bb.material.uniforms.uLensingEnabled.value = 0.0; // Handled by PP
            bb.material.uniforms.uEinsteinEnabled.value = shadersEnabled.einstein ? 1.0 : 0.0;
            bb.material.uniforms.uBloomEnabled.value = shadersEnabled.bloom ? 1.0 : 0.0;

            if (nextBH > 0.01) {
                // Project to screen space
                const pos = mesh.position.clone();
                pos.project(camera);
                const u = (pos.x * 0.5) + 0.5;
                const v = (pos.y * 0.5) + 0.5;
                bhCenters.push(new THREE.Vector2(u, v));
                bhStrengths.push(nextBH);

                // Calculate screen-space radius
                // Qubit radius is 2 units in world space.
                // We project a point on the surface to see its screen distance.
                const surfacePoint = mesh.position.clone().add(new THREE.Vector3(2, 0, 0));
                surfacePoint.project(camera);
                const surfaceU = (surfacePoint.x * 0.5) + 0.5;
                const radiusScreen = Math.abs(surfaceU - u) * (window.innerWidth / window.innerHeight); // Aspect corrected?
                // Actually the shader corrects aspect ratio when calculating 'r', 
                // but length(aspectCorrectedVec) where aspectCorrectedVec = vecToBH * vec2(aspect, 1.0)
                // means 'r' is in "y-normalized" units.
                // So radiusScreen should be in "y-normalized" units too.
                const radiusY = Math.abs((surfacePoint.y * 0.5) + 0.5 - v); // Screen height units
                const radiusX = Math.abs((surfacePoint.x * 0.5) + 0.5 - u) * (window.innerWidth / window.innerHeight);
                // Use the projected X distance but scaled by aspect ratio to match shader 'r'.
                bhRadii.push(radiusX);
            } else {
                bhCenters.push(new THREE.Vector2(0.5, 0.5));
                bhStrengths.push(0.0);
                bhRadii.push(0.1);
            }
        }

        let rippleIntensity = 0.0;
        if (shadersEnabled.entanglement) {
            const energy = micThresholds[i];
            if (energy > RIPPLE_THRESHOLD) {
                // Higher mapping to make it more visible: clamp to 0-1 and maybe boost
                rippleIntensity = Math.min((energy - RIPPLE_THRESHOLD) / (THRESHOLD_LIMIT - RIPPLE_THRESHOLD), 1.0);
            }
        }

        const currentRipple = mesh.material.uniforms.uEntanglement.value;
        mesh.material.uniforms.uEntanglement.value += (rippleIntensity - currentRipple) * 0.15; // Slightly faster transition

        // --- Update Quantum Clouds ---
        const clouds = qubitCloudMeshes[i];
        if (shadersEnabled.clouds) {
            // Map Probabilities to Opacity
            // Base opacity 0.5, modulate by prob
            clouds.state0.material.opacity = 0.5 * prob0;
            clouds.state1.material.opacity = 0.5 * prob1;

            // Map Phase to Rotation (State 1 Dumbbell)
            // Rotate along Z to spin the lobes? Or Y? 
            // Dumbbell generates with lobes along Y axis (as per code in quantum_clouds.js)
            // Let's spin it around Z axis to show phase.
            clouds.state1.rotation.z = qubit.phase;
            clouds.state1.rotation.y = time * 0.2; // Slowly rotate the whole thing for 3D effect? Or keep purely phase?
            // Pure phase is better for "mapping". 
            // Actually, a probability-weighted spin might be cool, but strict phase mapping requested:
            // "Phase -> controls the Rotation of meshState1 (e.g., meshState1.rotation.z)"

            clouds.state0.visible = true;
            clouds.state1.visible = true;

            // Hide Plasma Mesh if Clouds are enabled? 
            // User said "alternative shader", "switch and experiment".
            // Usually mutually exclusive makes sense for "Visualization Mode".
            // We'll handle mutual exclusivity in the UI/Control logic, or just enforce visibility here.
            mesh.visible = false;
        } else {
            clouds.state0.visible = false;
            clouds.state1.visible = false;
            // Restore Plasma Mesh visibility if it was globally enabled
            mesh.visible = shadersEnabled.qubit;
        }
    });

    // Update Post-Processing Lensing
    for (let i = 0; i < 4; i++) {
        if (i < bhCenters.length) {
            lensingPass.uniforms.uBHCenters.value[i] = bhCenters[i];
            lensingPass.uniforms.uBHStrengths.value[i] = bhStrengths[i];
            lensingPass.uniforms.uBHRadii.value[i] = bhRadii[i];
        } else {
            lensingPass.uniforms.uBHStrengths.value[i] = 0.0;
        }
    }
    lensingPass.uniforms.uLensingEnabled.value = shadersEnabled.lensing ? 1.0 : 0.0;


    if (particleSystem.uniforms) {
        particleSystem.uniforms.uTime.value = time;
        if (quantumCircuit.quantumState) {
            particleSystem.uniforms.uStateVector.value.set(quantumCircuit.quantumState.amplitudes);
        }
        qubits.forEach((q, idx) => {
            if (q.position) {
                particleSystem.uniforms.uPositions.value[idx].copy(q.position);
            }
        });
    }

    if (time % 1 < 0.016) {
        updateQuantumStateDisplay();
    }

    // [NEW] Update Volumetric Meshes
    qubitGodRays.forEach(mesh => {
        if (mesh) {
            mesh.update(time, camera);
            mesh.lookAt(camera.position);
            // Since Cone points +Z (local), looking at camera points base to camera?
            // Cone geometry setup: Tip at 0, Pointing +Z.
            // LookAt aligns +Z to target. So Tip points to Camera.
            // Wait, God Rays come FROM source TO camera.
            // If Tip is source (Qubit), then Tip -> Camera is correct direction.
            // Rays expand as they get closer.
            // Yes.
        }
    });

    // Audio Processing
    if (micManager.enabled) {
        micManager.update();

        // Single energy source from the mixed input (with noise gate)
        const globalEnergy = micManager.getEnergy();

        // Randomly target a qubit to apply this energy to
        const now = Date.now();
        if (!window.lastMicTargetTime || now - window.lastMicTargetTime > 100) {
            window.micTargetIndex = Math.floor(Math.random() * 4);
            window.lastMicTargetTime = now;
        }

        for (let i = 0; i < 4; i++) {
            // Only apply energy to the random target
            const energy = (i === window.micTargetIndex) ? globalEnergy : 0;

            if (i === window.micTargetIndex) {
                micThresholds[i] = energy;
            } else {
                micThresholds[i] = micThresholds[i] * 0.9;
            }

            const valueEl = document.getElementById(`value${i}`);
            const indicatorEl = document.getElementById(`indicator${i}`);
            const sliderEl = document.getElementById(`mic${i}`);

            if (valueEl) valueEl.textContent = micThresholds[i].toFixed(2);
            if (indicatorEl) indicatorEl.style.width = (micThresholds[i] * 100) + '%';
            if (sliderEl) sliderEl.value = micThresholds[i] * 100;

            if (micThresholds[i] > THRESHOLD_LIMIT && qubits[i].coherent) {
                if (indicatorEl) indicatorEl.classList.add('breach');
                qubits[i].collapse(Math.random() > 0.5 ? 1 : 0);

                // Global Entanglement Cleanup: Remove THIS qubit from all other qubits' lists
                qubits.forEach(otherQubit => {
                    if (otherQubit.id !== i) {
                        otherQubit.entangledWith = otherQubit.entangledWith.filter(linkedId => linkedId !== i);
                    }
                });

                // [NEW] Trigger Godrays & Sound
                if (quantumSound.enabled) quantumSound.playGodRaySound();

                // Trigger Visual
                if (shadersEnabled.godrays) {
                    triggerGodRay(i, 2.5, 4.0); // Index i, Duration 2.5s, Intensity 4.0
                }

            } else if (indicatorEl) {
                indicatorEl.classList.remove('breach');
            }
        }
    }

    // [REMOVED] Animate Godrays loop (Handled by shader now)

    quantumSound.update(qubits);

    controls.update();

    // --- Layered Rendering for Correct Lensing ---
    // Pass 1: Background & Particles (Layer 0) -> Lensed by Composer
    camera.layers.set(0);
    composer.render();

    // Pass 2: Qubits & Disc (Layer 1) -> Rendered ON TOP (No Lensing)
    // This prevents the Qubit from being "reflected" in the distortions
    renderer.autoClear = false;
    renderer.clearDepth(); // Clear depth buffer so Qubits sit on top
    camera.layers.set(1);
    renderer.render(scene, camera);
    renderer.autoClear = true;

    // Reset camera layers for next frame / controls
    camera.layers.enableAll();
}


animate();

window.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') {
        const coherentIndices = qubits.map((q, i) => q.coherent ? i : -1).filter(i => i !== -1);
        if (coherentIndices.length === 0) return;

        const i = coherentIndices[Math.floor(Math.random() * coherentIndices.length)];

        console.warn(`MANUAL DECOHERENCE TRIGGERED ON QUBIT ${i}`);

        qubits[i].collapse(Math.random() > 0.5 ? 1 : 0);

        // Global Entanglement Cleanup
        qubits.forEach(otherQubit => {
            if (otherQubit.id !== i) {
                otherQubit.entangledWith = otherQubit.entangledWith.filter(linkedId => linkedId !== i);
            }
        });

        if (quantumSound.enabled) quantumSound.playGodRaySound();

        // Trigger Visual
        if (shadersEnabled.godrays) {
            triggerGodRay(i, 2.5, 4.0);
        }
    }
});


window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    lensingPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

// Try to populate if permission already exists
navigator.permissions.query({ name: 'microphone' }).then(permissionStatus => {
    if (permissionStatus.state === 'granted') {
        refreshMicList();
    }
    permissionStatus.onchange = () => {
        if (permissionStatus.state === 'granted') {
            refreshMicList();
        }
    };
});
