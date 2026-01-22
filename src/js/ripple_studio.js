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
    resolution: 128,
    thickness: 0.2,
    splitCount: 1,
    pieceIndex: 0
};

// --- Mesh Setup ---
let mesh; // The visible mesh
let baseGeometryInfo = null; // Store base sphere info (uvs, etc) if needed, but we regenerate fully now.

// Helper to get noise displacement
function getDisplacement(x, y, z, time, strength) {
    // Match Shader Logic exactly:
    const noiseScale = 2.0;
    const timeScale = 5.0;

    const nx = x * noiseScale + time * timeScale;
    const ny = y * noiseScale + time * timeScale;
    const nz = z * noiseScale + time * timeScale;

    // Amplitude factor from shader
    let noiseVal = cnoise(nx, ny, nz) * 2.2;

    // Shader: displacement = noiseVal * uEntanglement * 0.6;
    return noiseVal * strength * 0.6;
}

function createCustomGeometry() {
    if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }

    // Parameters
    const radius = 2.0;
    const thickness = state.thickness;
    const widthSegments = state.resolution;
    const heightSegments = Math.floor(state.resolution / 2);

    // Splitting Logic
    // Total Anglular Range: 2PI
    // Piece Range: 2PI / splitCount
    // Start Angle: pieceIndex * (2PI / splitCount)
    const totalAngle = Math.PI * 2;
    const wedgeAngle = totalAngle / state.splitCount;
    const startAngle = state.pieceIndex * wedgeAngle;

    // Vertices arrays
    const vertices = [];
    const indices = [];

    // Helper to push vertex
    function pushVal(arr, vec) {
        arr.push(vec.x, vec.y, vec.z);
    }

    // We generate improved UV sphere topology
    // For a hollow wedge, we need:
    // 1. Outer Surface
    // 2. Inner Surface
    // 3. Side Wall 1 (Start Angle)
    // 4. Side Wall 2 (End Angle)
    // 5. Capping (Top/Bottom poles are tricky, but UV sphere poles are singularities)

    // Grid + 1 for vertices
    const gridX = widthSegments;
    const gridY = heightSegments;

    const vertexCountPerLayer = (gridX + 1) * (gridY + 1);

    // Store generated vertices temporarily to build faces
    // We store Position Vectors (after noise!)
    const outerVerts = [];
    const innerVerts = [];

    // --- 1. Generate Vertices and Apply Noise ---
    for (let iy = 0; iy <= gridY; iy++) {
        const v = iy / gridY; // 0 to 1
        const uOffset = 0; // standard sphere

        for (let ix = 0; ix <= gridX; ix++) {
            const u = ix / gridX; // 0 to 1

            // Angle calculation restricted to our wedge
            // u * wedgeAngle + startAngle
            // IMPORTANT: If splitCount == 1, we want full 0 to 2PI.
            // But UV sphere usually duplicates the first/last vertex at u=0 and u=1 for texture mapping.
            // For watertight geometry, we might want them unified if it's a full sphere, 
            // BUT for specific "Piece" logic derived here, we treat it as a wedge from 0 to 2PI.
            // If it is full sphere, we don't generate side walls.

            const currentPhi = startAngle + u * wedgeAngle;

            // Standard Sphere Formula
            // x = - r * cos(phi) * sin(theta)
            // y = r * cos(theta)
            // z = r * sin(phi) * sin(theta)
            // (Three.js standard implementation order might vary, adjusting to standard math)
            // Three.js PlaneGeometry:
            // theta: 0 to PI (y axis)
            // phi: 0 to 2PI (around y axis)

            const theta = v * Math.PI; // Pole to Pole
            const phi = currentPhi;

            // Base Unit Vector
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const ux = - sinPhi * sinTheta;
            const uy = cosTheta;
            const uz = cosPhi * sinTheta;

            const normal = new THREE.Vector3(ux, uy, uz); // Normalized

            // Base Positions
            const outerBase = normal.clone().multiplyScalar(radius);
            const innerBase = normal.clone().multiplyScalar(radius - thickness);

            // Apply Noise
            // Noise depends on *Original Position* (Base Outer Surface essentially) to keep sync
            const d = getDisplacement(outerBase.x, outerBase.y, outerBase.z, state.time, state.strength);

            // Displace both surfaces by same amount in direction of normal
            const outerPos = outerBase.add(normal.clone().multiplyScalar(d));
            const innerPos = innerBase.add(normal.clone().multiplyScalar(d)); // inner shell moves same distance? 
            // Ideally "Constant Thickness" means adding 'd' to both. 
            // If we scaled, thickness would vary. Adding vector match maintains wall width roughly.

            outerVerts.push(outerPos);
            innerVerts.push(innerPos);

            // Push to final buffer (Outer then Inner? Or strictly organized?)
            // We'll push them to linear buffer and track index math.
            // Let's create a single buffer for all vertices first, then push to attribute.
        }
    }

    // Add all verts to buffer
    outerVerts.forEach(v => pushVal(vertices, v));
    innerVerts.forEach(v => pushVal(vertices, v));

    // Indices Math
    // Outer Surface is standard grid
    // Inner Surface is standard grid (reversed winding)
    // Offset for Inner vertices = vertexCountPerLayer
    const innerOffset = vertexCountPerLayer;

    for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
            const a = iy * (gridX + 1) + (ix + 1);
            const b = iy * (gridX + 1) + ix;
            const c = (iy + 1) * (gridX + 1) + ix;
            const d = (iy + 1) * (gridX + 1) + (ix + 1);

            // Outer Surface (CCW)
            // faces: a,b,d; b,c,d
            indices.push(a, b, d);
            indices.push(b, c, d);

            // Inner Surface (CW - reversed)
            // To face inward/outward correctly?
            // "Solid" mesh: Inner surface normals points IN towards center? 
            // No, strictly speaking for a solid volume, all normals point "Out of the volume".
            // So Inner Surface (the cavity wall) normals should point towards center (0,0,0).
            // Default UV sphere normals point out.
            // So we need to reverse winding for Inner Surface relative to the "Sphere".
            // i.e., indices: a,d,b; b,d,c (permuted)
            // But applied to (a+offset, etc)

            const ao = a + innerOffset;
            const bo = b + innerOffset;
            const co = c + innerOffset;
            const do_ = d + innerOffset;

            indices.push(ao, do_, bo);
            indices.push(bo, do_, co);
        }
    }

    // --- Side Walls (Wedges) ---
    // If splitCount > 1, we must close the sides.
    // If splitCount == 1 (Full Sphere), we must NOT close sides... UNLESS we want a seam?
    // For Full Sphere 3D printing, usually we just want 2 nested shells.
    // BUT STLExporter might struggle with "Nested but unconnected" shells determining what is solid.
    // Most slicers (Cura/Prusa) handle "Object - Hole" correctly if normals are opposed.
    // However, if we want a TRULY hollow object (like a ball with wall thickness), usually it's one solid mesh.
    // That implies connecting the shells?
    // A full hollow sphere has no opening. You cannot "connect" them topologically without a hole.
    // So for splitCount=1, we return two disconnected shells (Outer facing out, Inner facing in).
    // This is valid "Hollow" geometry.

    if (state.splitCount > 1) {
        // We have exposed edges at ix=0 and ix=gridX.
        // Side 1: ix=0 (Start Angle). Connect Outer(ix=0) to Inner(ix=0)
        // Side 2: ix=gridX (End Angle). Connect Outer(ix=gridX) to Inner(ix=gridX)

        // Loop vertically (iy)
        for (let iy = 0; iy < gridY; iy++) {
            // --- Side 1 (Start) ---
            // Vertices along the "left" edge
            // Outer: (iy, 0) and (iy+1, 0)
            // Inner: (iy, 0)_in and (iy+1, 0)_in

            const top_out = iy * (gridX + 1);
            const bot_out = (iy + 1) * (gridX + 1);

            const top_in = top_out + innerOffset;
            const bot_in = bot_out + innerOffset;

            // Quad: top_out, bot_out, bot_in, top_in
            // Winding: needs to point roughly "left" (negative tangent).
            // Test: t_o, b_o, t_in is CCW?
            indices.push(top_out, bot_out, top_in);
            indices.push(bot_out, bot_in, top_in);

            // --- Side 2 (End) ---
            // Vertices along "right" edge
            // ix = gridX
            const top_out_r = iy * (gridX + 1) + gridX;
            const bot_out_r = (iy + 1) * (gridX + 1) + gridX;

            const top_in_r = top_out_r + innerOffset;
            const bot_in_r = bot_out_r + innerOffset;

            // Quad: top_out_r, bot_out_r, bot_in_r, top_in_r
            // Winding: opposite of Side 1
            indices.push(top_out_r, top_in_r, bot_out_r);
            indices.push(bot_out_r, top_in_r, bot_in_r);
        }
    }
    // If splitCount == 1, we leave them unconnected.

    // Calculate Geometry
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufferGeometry.setIndex(indices);
    bufferGeometry.computeVertexNormals();

    // Material
    const material = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        roughness: 0.4,
        metalness: 0.2,
        side: THREE.DoubleSide, // Ensure we see both sides in preview
        flatShading: false
    });

    mesh = new THREE.Mesh(bufferGeometry, material);
    scene.add(mesh);
}

// --- Updates ---
function updateGeometry() {
    createCustomGeometry(); // Full regeneration needed for thickness/splitting changes
}

// --- UI Handling ---
const timeSlider = document.getElementById('time-slider');
const strengthSlider = document.getElementById('strength-slider');
const resolutionSlider = document.getElementById('resolution-slider');
const thicknessSlider = document.getElementById('thickness-slider');
const splitSelect = document.getElementById('split-select');
const pieceGroup = document.getElementById('piece-group');
const pieceSelect = document.getElementById('piece-select');
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
    updateGeometry();
});

thicknessSlider.addEventListener('input', (e) => {
    state.thickness = parseFloat(e.target.value);
    document.getElementById('thickness-display').textContent = state.thickness.toFixed(2);
    updateGeometry();
});

splitSelect.addEventListener('change', (e) => {
    state.splitCount = parseInt(e.target.value);
    // Update Piece Selector
    pieceSelect.innerHTML = '';
    for (let i = 0; i < state.splitCount; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = `Piece ${i + 1}`;
        pieceSelect.appendChild(opt);
    }
    state.pieceIndex = 0;

    // Show/Hide Piece Selector
    if (state.splitCount > 1) {
        pieceGroup.style.display = 'block';
    } else {
        pieceGroup.style.display = 'none';
    }

    updateGeometry();
});

pieceSelect.addEventListener('change', (e) => {
    state.pieceIndex = parseInt(e.target.value);
    updateGeometry();
});


exportBtn.addEventListener('click', () => {
    const exporter = new STLExporter();
    const stlString = exporter.parse(mesh, { binary: true });

    const blob = new Blob([stlString], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    // Filename: ripple_sphere_t5.0_s0.5_p1_of_4.stl
    let name = `ripple_sphere_t${state.time.toFixed(1)}`;
    if (state.splitCount > 1) {
        name += `_piece${state.pieceIndex + 1}of${state.splitCount}`;
    }
    name += '.stl';

    link.download = name;
    link.click();
});

// --- Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Init ---
updateGeometry();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
