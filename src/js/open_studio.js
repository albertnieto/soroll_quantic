import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// --- Scene Setup ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 100);
spotLight.position.set(10, 20, 10);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
scene.add(spotLight);

const fillLight = new THREE.DirectionalLight(0x00d2ff, 2);
fillLight.position.set(-10, 5, -5);
scene.add(fillLight);

// --- Background / Grid ---
const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
grid.position.y = -0.01;
scene.add(grid);

// --- Studio State ---
const studio = {
    mesh: null,
    material: new THREE.MeshStandardMaterial({
        color: 0x00d2ff,
        metalness: 0.6,
        roughness: 0.2,
        wireframe: false,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
    }),
    autoRotate: false,
    loader: new STLLoader()
};

// --- Loading Logic ---
function loadSTL(url, fileName = "Unknown Model") {
    // Show loader if needed
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-overlay').style.opacity = '1';

    studio.loader.load(url, (geometry) => {
        if (studio.mesh) {
            scene.remove(studio.mesh);
            studio.mesh.geometry.dispose();
        }

        studio.mesh = new THREE.Mesh(geometry, studio.material);
        studio.mesh.castShadow = true;
        studio.mesh.receiveShadow = true;

        // Center and Scale
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.center(); // This centers the geometry itself

        // Auto-scale to fit comfortably
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;
        studio.mesh.scale.set(scale, scale, scale);

        // Position it on the grid
        studio.mesh.position.y = (size.y * scale) / 2;

        scene.add(studio.mesh);

        // Update UI
        document.getElementById('file-info').textContent = fileName;

        // Hide loader
        setTimeout(() => {
            document.getElementById('loading-overlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-overlay').style.display = 'none';
            }, 500);
        }, 300);

        resetCamera();
    }, (xhr) => {
        // Progress
        const percent = (xhr.loaded / xhr.total) * 100;
        console.log(percent + '% loaded');
    }, (error) => {
        console.error('An error happened', error);
        alert("Failed to load STL file.");
        document.getElementById('loading-overlay').style.display = 'none';
    });
}

function handleFile(file) {
    if (file && file.name.toLowerCase().endsWith('.stl')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            loadSTL(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    } else {
        alert("Please upload a valid .stl file.");
    }
}

// --- UI Event Listeners ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const colorPicker = document.getElementById('color-picker');
const wireframeToggle = document.getElementById('wireframe-toggle');
const autoRotateToggle = document.getElementById('auto-rotate-toggle');
const opacitySlider = document.getElementById('opacity-slider');
const resetBtn = document.getElementById('reset-view');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent-color)';
    dropZone.style.background = 'rgba(255, 255, 255, 0.05)';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = 'none';
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    dropZone.style.background = 'none';
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

colorPicker.addEventListener('input', (e) => {
    studio.material.color.set(e.target.value);
});

wireframeToggle.addEventListener('change', (e) => {
    studio.material.wireframe = e.target.checked;
});

autoRotateToggle.addEventListener('change', (e) => {
    studio.autoRotate = e.target.checked;
});

opacitySlider.addEventListener('input', (e) => {
    studio.material.opacity = parseFloat(e.target.value);
});

function resetCamera() {
    controls.reset();
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
}

resetBtn.addEventListener('click', resetCamera);

// --- Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (studio.mesh && studio.autoRotate) {
        studio.mesh.rotation.y += 0.005;
    }

    controls.update();
    renderer.render(scene, camera);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Initial hide of loader after a brief moment
    setTimeout(() => {
        document.getElementById('loading-overlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-overlay').style.display = 'none';
        }, 500);
    }, 1000);
});

animate();
