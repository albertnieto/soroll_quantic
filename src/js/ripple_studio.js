import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { cnoise } from './classic_noise.js';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// --- State ---
const state = {
    time: 0,
    strength: 0.5,
    resolution: 128
};

// --- Mesh Setup ---
let mesh;
let originalPositions; // Store original vertex positions to apply noise on top

function createMesh() {
    if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }

    const geometry = new THREE.SphereGeometry(2, state.resolution, state.resolution);

    // Store original positions for deformation reference
    const posAttribute = geometry.attributes.position;
    originalPositions = new Float32Array(posAttribute.count * 3);
    for (let i = 0; i < posAttribute.count; i++) {
        originalPositions[i * 3] = posAttribute.getX(i);
        originalPositions[i * 3 + 1] = posAttribute.getY(i);
        originalPositions[i * 3 + 2] = posAttribute.getZ(i);
    }

    // Material that looks good for preview
    const material = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        roughness: 0.4,
        metalness: 0.2,
        flatShading: false, // Smooth shading for preview
        wireframe: false
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    updateGeometry(); // Apply initial noise
}

// --- Noise & Deformation Logic ---
function updateGeometry() {
    if (!mesh || !originalPositions) return;

    const posAttribute = mesh.geometry.attributes.position;

    // We assume sphere normals are effectively normalized positions.

    for (let i = 0; i < posAttribute.count; i++) {
        const ox = originalPositions[i * 3];
        const oy = originalPositions[i * 3 + 1];
        const oz = originalPositions[i * 3 + 2];

        const p = new THREE.Vector3(ox, oy, oz);
        const normal = p.clone().normalize();

        // Match Shader Logic exactly:
        // float noiseVal = cnoise(pos * 2.0 + uTime * 5.0);
        // Note: cnoise(vec3) in GLSL usually adds the scalar to all components if written 'vec3 + float'.
        // Let's replicate: P = pos * 2.0 + 5.0 * time

        const noiseScale = 2.0;
        const timeScale = 5.0; // Shader value

        const nx = ox * noiseScale + state.time * timeScale;
        const ny = oy * noiseScale + state.time * timeScale;
        const nz = oz * noiseScale + state.time * timeScale;

        // The cnoise implementation in shaders.js returns "2.2 * n_xyz".
        // My ported JS cnoise implementation returns standard Perlin range (-1 to 1 approx).
        // So I multiply by 2.2 to match the amplitude.
        let noiseVal = cnoise(nx, ny, nz) * 2.2;

        // Shader: displacement = noiseVal * uEntanglement * 0.6;
        const displacement = noiseVal * state.strength * 0.6;

        const newPos = p.add(normal.multiplyScalar(displacement));

        posAttribute.setXYZ(i, newPos.x, newPos.y, newPos.z);
    }

    mesh.geometry.computeVertexNormals(); // Recalculate normals for lighting
    posAttribute.needsUpdate = true;
}


// --- Export Logic ---
function exportSTL() {
    const exporter = new STLExporter();
    const stlString = exporter.parse(mesh, { binary: true });

    const blob = new Blob([stlString], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ripple_sphere_t${state.time.toFixed(1)}_s${state.strength.toFixed(1)}.stl`;
    link.click();
}


// --- UI Handling ---
const timeSlider = document.getElementById('time-slider');
const strengthSlider = document.getElementById('strength-slider');
const resolutionSlider = document.getElementById('resolution-slider');
const exportBtn = document.getElementById('export-btn');

timeSlider.addEventListener('input', (e) => {
    state.time = parseFloat(e.target.value);
    document.getElementById('time-display').textContent = state.time.toFixed(1);
    updateGeometry();
});

strengthSlider.addEventListener('input', (e) => {
    state.strength = parseFloat(e.target.value);
    document.getElementById('strength-display').textContent = state.strength.toFixed(2);
    updateGeometry();
});

resolutionSlider.addEventListener('change', (e) => {
    state.resolution = parseInt(e.target.value);
    document.getElementById('resolution-display').textContent = state.resolution;
    createMesh(); // Recreate mesh with new resolution
});

exportBtn.addEventListener('click', exportSTL);

// --- Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Init ---
createMesh();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
