import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { Qubit } from './Qubit.js';
import { plasmaVertexShader, plasmaFragmentShader, qubitVertexShader, qubitFragmentShader } from './shaders.js';
import { particleVertexShader, particleFragmentShader } from './advanced_shaders.js';
import { blackHoleBillboardVertexShader, blackHoleBillboardFragmentShader, lensingFsQuadShader } from './black_hole_shader.js';
import { QuantumCircuit } from './quantum_circuit.js';
import { QuantumSound } from './quantum_sound.js';
import { MicManager } from './mic_manager.js';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);
scene.background = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas').appendChild(renderer.domElement);

// --- Post Processing Setup ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const lensingPass = new ShaderPass(lensingFsQuadShader);
lensingPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
composer.addPass(lensingPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let qubitSpacing = 8.5;
const qubits = [];
const qubitMeshes = [];
const particleSystem = { mesh: null, uniforms: null };
const quantumCircuit = new QuantumCircuit();
const quantumSound = new QuantumSound();
const micManager = new MicManager();

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
        positions[i * 3] = (Math.random() - 0.5) * 32.0; // X
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
            uEntanglement: { value: 0.0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
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

    scene.add(mesh);
    qubitMeshes.push(mesh);
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

let autoExecute = false;
let autoExecuteInterval = null;
let currentMode = 'manual';

const circuitModeSelect = document.getElementById('circuit-mode');
circuitModeSelect.addEventListener('change', (e) => {
    currentMode = e.target.value;

    if (currentMode === 'manual') {
        document.getElementById('manual-controls').style.display = 'block';
        document.getElementById('circuit-mode-controls').style.display = 'none';
    } else {
        document.getElementById('manual-controls').style.display = 'none';
        document.getElementById('circuit-mode-controls').style.display = 'block';

        quantumCircuit.reset();
        quantumCircuit.loadCircuit(currentMode).then(() => {
            const img = document.getElementById('circuit-diagram-img');
            if (img) {
                img.src = '/circuits/circuit_diagram.png?t=' + Date.now();
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
            });
        } else if (gate.type === 'H') {
            gate.wires.forEach(wire => {
                qubits[wire].alpha = Math.cos(Math.PI / 4);
                qubits[wire].beta = Math.sin(Math.PI / 4);
                qubits[wire].coherent = true;
            });
        } else if (gate.type === 'CNOT') {
            const control = gate.wires[0];
            const target = gate.wires[1];
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
                qubits[wire].alpha = Math.cos(angle / 2);
                qubits[wire].beta = Math.sin(angle / 2);
            });
        } else if (gate.type === 'RX') {
            const angle = gate.params[0];
            gate.wires.forEach(wire => {
                const cos = Math.cos(angle / 2);
                const sin = Math.sin(angle / 2);
                const newAlpha = cos * qubits[wire].alpha;
                const newBeta = sin * qubits[wire].beta;
                qubits[wire].alpha = newAlpha;
                qubits[wire].beta = newBeta;
            });
        } else if (gate.type === 'RZ') {
            const angle = gate.params[0];
            gate.wires.forEach(wire => {
                qubits[wire].phase += angle;
            });
        }
        updateQuantumStateDisplay();
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

document.getElementById('auto-execute').addEventListener('click', () => {
    autoExecute = !autoExecute;
    document.getElementById('auto-execute').textContent = autoExecute ? 'Stop Auto' : 'Auto Execute';

    if (autoExecute) {
        autoExecuteInterval = setInterval(() => {
            if (!executeNextGate()) {
                setTimeout(() => executeNextGate(), 1000);
            }
        }, 1500);
    } else {
        clearInterval(autoExecuteInterval);
    }
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
    orbital: true,
    entanglement: false,
    accretion: true,
    lensing: true,
    einstein: true,
    bloom: true
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

['accretion', 'lensing', 'einstein', 'bloom'].forEach(key => {
    document.getElementById(`toggle-${key}`).addEventListener('change', (e) => {
        shadersEnabled[key] = e.target.checked;
    });
});

document.getElementById('toggle-entanglement').addEventListener('change', (e) => {
    shadersEnabled.entanglement = e.target.checked;
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

document.getElementById('toggle-sound').addEventListener('change', (e) => {
    const enabled = quantumSound.toggle();
    e.target.checked = enabled;
});

document.getElementById('sound-volume').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('volume-value').textContent = value + '%';
    quantumSound.setVolume(value / 100);
});

document.getElementById('sound-bass').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('bass-value').textContent = value + '%';
    quantumSound.setBassDepth(value / 100);
});

document.getElementById('sound-resonance').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('resonance-value').textContent = value + '%';
    quantumSound.setResonance(value / 100);
});

document.getElementById('start-mic').addEventListener('click', async () => {
    await micManager.init();
    document.getElementById('start-mic').textContent = micManager.enabled ? 'Live Mic Active' : 'Retry Mic';
    document.getElementById('start-mic').style.background = micManager.enabled ? '#007777' : '#440000';
});

let uiVisible = true;
document.getElementById('toggle-ui').addEventListener('click', () => {
    uiVisible = !uiVisible;
    document.body.classList.toggle('ui-hidden', !uiVisible);
    document.getElementById('toggle-ui').textContent = uiVisible ? 'Hide UI' : 'Show UI';
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
            } else {
                bhCenters.push(new THREE.Vector2(0.5, 0.5));
                bhStrengths.push(0.0);
            }
        }

        let entanglementStrength = 0.0;
        if (shadersEnabled.entanglement && qubit.coherent && qubit.entangledWith.length > 0) {
            entanglementStrength = 1.0;
        }

        const currentEnt = mesh.material.uniforms.uEntanglement.value;
        mesh.material.uniforms.uEntanglement.value += (entanglementStrength - currentEnt) * 0.1;
    });

    // Update Post-Processing Lensing
    for (let i = 0; i < 4; i++) {
        if (i < bhCenters.length) {
            lensingPass.uniforms.uBHCenters.value[i] = bhCenters[i];
            lensingPass.uniforms.uBHStrengths.value[i] = bhStrengths[i];
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

    if (micManager.enabled) {
        micManager.update();
        for (let i = 0; i < 4; i++) {
            const energy = micManager.getEnergy(i);
            micThresholds[i] = energy;

            const valueEl = document.getElementById(`value${i}`);
            const indicatorEl = document.getElementById(`indicator${i}`);
            const sliderEl = document.getElementById(`mic${i}`);

            if (valueEl) valueEl.textContent = energy.toFixed(2);
            if (indicatorEl) indicatorEl.style.width = (energy * 100) + '%';
            if (sliderEl) sliderEl.value = energy * 100;

            if (energy > THRESHOLD_LIMIT && qubits[i].coherent) {
                if (indicatorEl) indicatorEl.classList.add('breach');
                qubits[i].collapse(Math.random() > 0.5 ? 1 : 0);
            } else if (indicatorEl) {
                indicatorEl.classList.remove('breach');
            }
        }
    }

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

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    lensingPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});
