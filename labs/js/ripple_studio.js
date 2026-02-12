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
const ambientLight = new THREE.AmbientLight(0xffffff, 4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Add a secondary fill light for "Studio" look
const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
fillLight.position.set(-5, -5, -7);
scene.add(fillLight);

// --- State ---
const state = {
    primitive: 'sphere',
    modifier: 'none',
    mathMode: 'noise',
    theme: 'light',
    time: 0,
    strength: 0.5,
    resolution: 256,
    thickness: 0.2,
    splitCount: 1,
    pieceIndex: 0,
    // New Material/Meta State
    color: '#00aaff',
    materialType: 'standard',
    roughness: 0.4,
    metalness: 0.2,
    rotationSpeed: 0.0,
    autoAnimate: true,
    // Lighting State
    ambientIntensity: 4.0,
    keyLightIntensity: 3.0
};

// --- Mesh Setup ---
let mesh; // The visible mesh
let baseGeometryInfo = null; // Store base sphere info (uvs, etc) if needed, but we regenerate fully now.

// Helper to get displacement/offset based on math mode
// Returns { offset: Vector3, visible: boolean }
function getDisplacement(x, y, z, time, strength) {
    const r = Math.sqrt(x * x + y * y + z * z);
    const theta = Math.acos(z / r || 0);
    const phiAngle = Math.atan2(y, x);
    const normal = new THREE.Vector3(x, y, z).normalize();

    let offset = new THREE.Vector3(0, 0, 0);
    let visible = true;

    if (state.mathMode === 'noise') {
        const noiseScale = 2.0;
        const timeScale = 5.0;
        const val = cnoise(x * noiseScale + time * timeScale, y * noiseScale + time * timeScale, z * noiseScale + time * timeScale);
        offset = normal.clone().multiplyScalar(val * 2.2 * strength * 0.6);
    } else if (state.mathMode === 'golden') {
        const phi = 1.61803398875;
        const val = Math.sin(x * phi + time) + Math.cos(y * phi + time) + Math.sin(z * phi + time);
        offset = normal.clone().multiplyScalar(val * strength * 0.3);
    } else if (state.mathMode === 'quantum') {
        const val = Math.sin(theta * 4) * Math.cos(phiAngle * 3 + time);
        offset = normal.clone().multiplyScalar(val * strength * 0.5);
    } else if (state.mathMode === 'sine') {
        const val = Math.sin(x * 3 + time) * Math.cos(y * 3 + time) * Math.sin(z * 3 + time);
        offset = normal.clone().multiplyScalar(val * strength * 0.4);
    } else if (state.mathMode === 'vortex') {
        const swirl = Math.sin(theta * 10 + phiAngle * 2 + time * 2);
        const taper = Math.sin(theta);
        offset = normal.clone().multiplyScalar(swirl * taper * strength * 0.5);
    } else if (state.mathMode === 'cellular') {
        let val = cnoise(x * 2 + time, y * 2, z * 2) * 0.5;
        val += cnoise(x * 5 - time, y * 5, z * 5) * 0.25;
        offset = normal.clone().multiplyScalar(val * strength * 1.5);
    } else if (state.mathMode === 'interference') {
        const w1 = Math.sin(x * 10 + time);
        const w2 = Math.sin(y * 10 + time * 1.5);
        offset = normal.clone().multiplyScalar((w1 * w2) * strength * 0.4);
    } else if (state.mathMode === 'pulse') {
        const heart = Math.pow(Math.sin(time * 2), 4);
        const burst = Math.sin(r * 15 - time * 10);
        offset = normal.clone().multiplyScalar(burst * heart * strength * 0.6);
    } else if (state.mathMode === 'twister') {
        // --- SURFACE SWIRL / TORSION ---
        // Rotates the point around the Y axis based on height and noise
        const twistAmount = (y + 2) * strength * 2; // Linear twist by height
        const noiseTwist = cnoise(x, y + time, z) * strength * 3;
        const totalAngle = twistAmount + noiseTwist;

        const cosA = Math.cos(totalAngle);
        const sinA = Math.sin(totalAngle);

        // Manual rotation logic
        const newX = x * cosA - z * sinA;
        const newZ = x * sinA + z * cosA;
        offset = new THREE.Vector3(newX - x, 0, newZ - z);
    } else if (state.mathMode === 'glitch') {
        // --- STEPPED / BLOCKY ---
        const steps = 8.0;
        const raw = cnoise(x * 2, y * 2 + time, z * 2);
        const val = Math.floor(raw * steps) / steps;
        offset = normal.clone().multiplyScalar(val * strength * 2.0);
    } else if (state.mathMode === 'shattered') {
        // --- HOLES / TEARING ---
        const noise = cnoise(x * 1.5, y * 1.5, z * 1.5 + time);
        if (noise > 0.3) visible = false;
        offset = normal.clone().multiplyScalar(noise * strength);
    } else if (state.mathMode === 'jagged') {
        // --- SPIKES / FRACTURE ---
        const val = 1.0 - Math.abs(cnoise(x * 4, y * 4, z * 4 + time));
        offset = normal.clone().multiplyScalar(val * strength * 1.2);
    }

    return { offset, visible };
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

    // Store visibility flags
    const outerVisible = [];

    // --- 1. Generate Vertices based on Primitive ---
    for (let iy = 0; iy <= gridY; iy++) {
        const v = iy / gridY;
        for (let ix = 0; ix <= gridX; ix++) {
            const u = ix / gridX;

            let baseNormal = new THREE.Vector3();
            let baseOuter = new THREE.Vector3();
            let baseInner = new THREE.Vector3();

            if (state.primitive === 'sphere') {
                const currentPhi = startAngle + u * wedgeAngle;
                const theta = v * Math.PI;
                baseNormal.set(
                    - Math.sin(currentPhi) * Math.sin(theta),
                    Math.cos(theta),
                    Math.cos(currentPhi) * Math.sin(theta)
                );
                baseOuter.copy(baseNormal).multiplyScalar(radius);
                baseInner.copy(baseNormal).multiplyScalar(radius - thickness);
            } else if (state.primitive === 'torus') {
                const mainR = 1.4;
                const tubeR = 0.6;
                const phi = u * Math.PI * 2;
                const theta = v * Math.PI * 2;
                const x = (mainR + tubeR * Math.cos(theta)) * Math.cos(phi);
                const y = tubeR * Math.sin(theta);
                const z = (mainR + tubeR * Math.cos(theta)) * Math.sin(phi);
                baseOuter.set(x, y, z);
                const center = new THREE.Vector3(mainR * Math.cos(phi), 0, mainR * Math.sin(phi));
                baseNormal.copy(baseOuter).sub(center).normalize();
                baseInner.copy(baseOuter).sub(baseNormal.clone().multiplyScalar(thickness));
            } else if (state.primitive === 'knot') {
                // Proper Tubular Trefoil Knot
                const t = u * Math.PI * 2;
                const p = v * Math.PI * 2;
                const p1 = new THREE.Vector3(
                    Math.sin(t) + 2 * Math.sin(2 * t),
                    Math.cos(t) - 2 * Math.cos(2 * t),
                    -Math.sin(3 * t)
                ).multiplyScalar(0.5);
                // Simple orientation frame
                const p2 = new THREE.Vector3(
                    Math.sin(t + 0.01) + 2 * Math.sin(2 * (t + 0.01)),
                    Math.cos(t + 0.01) - 2 * Math.cos(2 * (t + 0.01)),
                    -Math.sin(3 * (t + 0.01))
                ).multiplyScalar(0.5);
                const tangent = p2.clone().sub(p1).normalize();
                const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
                const binormal = tangent.clone().cross(normal).normalize();

                const tubeR = 0.3;
                const offsetX = Math.cos(p) * tubeR;
                const offsetY = Math.sin(p) * tubeR;

                baseNormal.copy(normal).multiplyScalar(Math.cos(p)).add(binormal.clone().multiplyScalar(Math.sin(p))).normalize();
                baseOuter.copy(p1).add(baseNormal.clone().multiplyScalar(tubeR));
                baseInner.copy(p1).add(baseNormal.clone().multiplyScalar(tubeR - thickness));
            } else if (state.primitive === 'box') {
                // Spherical Cube mapping
                const currentPhi = startAngle + u * wedgeAngle;
                const theta = v * Math.PI;
                const sx = Math.sin(theta) * Math.cos(currentPhi);
                const sy = Math.cos(theta);
                const sz = Math.sin(theta) * Math.sin(currentPhi);
                // Clamp to box
                const max = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
                baseNormal.set(sx, sy, sz).normalize();
                baseOuter.set(sx / max * 1.5, sy / max * 1.5, sz / max * 1.5);
                baseInner.copy(baseOuter).sub(baseNormal.clone().multiplyScalar(thickness));
            } else if (state.primitive === 'cylinder') {
                const currentPhi = startAngle + u * wedgeAngle;
                const h = (v - 0.5) * 3.0;
                baseNormal.set(Math.cos(currentPhi), 0, Math.sin(currentPhi));
                baseOuter.set(Math.cos(currentPhi) * 1.2, h, Math.sin(currentPhi) * 1.2);
                baseInner.set(Math.cos(currentPhi) * (1.2 - thickness), h, Math.sin(currentPhi) * (1.2 - thickness));
            } else if (state.primitive === 'capsule') {
                const currentPhi = startAngle + u * wedgeAngle;
                const t = v * Math.PI;
                let y = (v - 0.5) * 2;
                let r = 1.0;
                if (v < 0.2) { // Top Cap
                    const vCap = v / 0.2;
                    y = 1.0 + Math.sin(vCap * Math.PI / 2 - Math.PI / 2);
                    r = Math.cos(vCap * Math.PI / 2 - Math.PI / 2);
                } else if (v > 0.8) { // Bottom Cap
                    const vCap = (v - 0.8) / 0.2;
                    y = -1.0 - Math.sin(vCap * Math.PI / 2);
                    r = Math.cos(vCap * Math.PI / 2);
                }
                baseNormal.set(Math.cos(currentPhi) * r, v < 0.2 ? 1 : (v > 0.8 ? -1 : 0), Math.sin(currentPhi) * r).normalize();
                baseOuter.set(Math.cos(currentPhi) * r, y, Math.sin(currentPhi) * r);
                baseInner.copy(baseOuter).sub(baseNormal.clone().multiplyScalar(thickness));
            } else if (state.primitive === 'ashtray') {
                const R = 1.8; // Outer Radius
                const r = 1.35; // Bowl Radius
                const H = 0.8; // Total Wall Height
                const bH = 0.2; // Floor height from bottom
                const phi = startAngle + u * wedgeAngle;

                const rimHeight = H;

                // Clean 4-segment mapping for the "Upper Surface"
                if (v < 0.3) { // Outer cylinder wall
                    const t = v / 0.3;
                    baseOuter.set(Math.cos(phi) * R, t * H, Math.sin(phi) * R);
                    baseNormal.set(Math.cos(phi), 0, Math.sin(phi));
                } else if (v < 0.4) { // Top Rim
                    const t = (v - 0.3) / 0.1;
                    const curR = R - t * (R - r);
                    baseOuter.set(Math.cos(phi) * curR, rimHeight, Math.sin(phi) * curR);
                    baseNormal.set(0, 1, 0);
                } else if (v < 0.7) { // Inner bowl wall
                    const t = (v - 0.4) / 0.3;
                    const curH = rimHeight - t * (H - bH);
                    baseOuter.set(Math.cos(phi) * r, curH, Math.sin(phi) * r);
                    baseNormal.set(-Math.cos(phi), 0, -Math.sin(phi));
                } else { // Bowl Floor
                    const t = (v - 0.7) / 0.3;
                    const curR = r * (1.0 - t);
                    baseOuter.set(Math.cos(phi) * curR, bH, Math.sin(phi) * curR);
                    baseNormal.set(0, 1, 0);
                }

                // For a solid, 3D printable object:
                // baseInner is the "Casing" (The bottom and underside)
                baseInner.copy(baseOuter);
                if (v < 0.3) {
                    baseInner.set(Math.cos(phi) * (R - thickness), baseOuter.y, Math.sin(phi) * (R - thickness));
                } else {
                    baseInner.y = 0; // Flat base
                }
            } else if (state.primitive === 'knot') {
                // Trefoil Knot with robust Frenet-Serret frame
                const t = u * Math.PI * 2;
                const pAngle = v * Math.PI * 2;
                const getPos = (currT) => new THREE.Vector3(
                    Math.sin(currT) + 2 * Math.sin(2 * currT),
                    Math.cos(currT) - 2 * Math.cos(2 * currT),
                    -Math.sin(3 * currT)
                ).multiplyScalar(0.6);

                const p1 = getPos(t);
                const p2 = getPos(t + 0.01);
                const tangent = p2.clone().sub(p1).normalize();
                const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
                if (normal.length() < 0.1) normal.set(1, 0, 0).cross(tangent).normalize();
                const binormal = tangent.clone().cross(normal).normalize();

                const tubeR = 0.35;
                const cx = Math.cos(pAngle) * tubeR;
                const cy = Math.sin(pAngle) * tubeR;

                baseNormal.copy(normal).multiplyScalar(Math.cos(pAngle)).add(binormal.clone().multiplyScalar(Math.sin(pAngle))).normalize();
                baseOuter.copy(p1).add(baseNormal.clone().multiplyScalar(tubeR));
                baseInner.copy(p1).add(baseNormal.clone().multiplyScalar(tubeR - thickness));
            } else if (state.primitive === 'cone') {
                const phi = startAngle + u * wedgeAngle;
                const h = (1.0 - v) * 3.0; // Pointy at top (v=1)
                const r = v * 1.5;
                baseOuter.set(Math.cos(phi) * r, h, Math.sin(phi) * r);
                baseNormal.set(Math.cos(phi), 0.5, Math.sin(phi)).normalize();
                baseInner.copy(baseOuter).sub(baseNormal.clone().multiplyScalar(thickness));
            } else if (state.primitive === 'pyramid') {
                const h = (1.0 - v) * 3.0;
                const r = v * 1.5;
                const phi = startAngle + u * wedgeAngle;
                const x = Math.cos(phi) * r;
                const z = Math.sin(phi) * r;
                // Square clamping
                const max = Math.max(Math.abs(Math.cos(phi)), Math.abs(Math.sin(phi)));
                baseOuter.set(x / max, h, z / max);
                baseNormal.set(x, 1, z).normalize();
                baseInner.copy(baseOuter).sub(baseNormal.clone().multiplyScalar(thickness));
            } else if (state.primitive === 'plane') {
                baseOuter.set((u - 0.5) * 4, (v - 0.5) * 4, 0);
                baseNormal.set(0, 0, 1);
                baseInner.set((u - 0.5) * 4, (v - 0.5) * 4, -thickness);
            }

            // Apply Surface Math
            const result = getDisplacement(baseOuter.x, baseOuter.y, baseOuter.z, state.time, state.strength);

            let finalOuter = baseOuter.clone().add(result.offset);
            let finalInner = baseInner.clone().add(result.offset);

            // Apply Structural Modifiers
            if (state.modifier === 'jitter') {
                const noiseX = (Math.random() - 0.5) * 0.2 * state.strength;
                const noiseY = (Math.random() - 0.5) * 0.2 * state.strength;
                const noiseZ = (Math.random() - 0.5) * 0.2 * state.strength;
                const noiseVec = new THREE.Vector3(noiseX, noiseY, noiseZ);
                finalOuter.add(noiseVec);
                finalInner.add(noiseVec);
            } else if (state.modifier === 'voxel') {
                const step = 0.2 / (state.strength + 0.1);
                finalOuter.set(
                    Math.round(finalOuter.x / step) * step,
                    Math.round(finalOuter.y / step) * step,
                    Math.round(finalOuter.z / step) * step
                );
                finalInner.set(
                    Math.round(finalInner.x / step) * step,
                    Math.round(finalInner.y / step) * step,
                    Math.round(finalInner.z / step) * step
                );
            } else if (state.modifier === 'liquid') {
                const wave = Math.sin(finalOuter.y * 5 + state.time * 2) * 0.2 * state.strength;
                finalOuter.x += wave;
                finalInner.x += wave;
                finalOuter.z += Math.cos(finalOuter.y * 5 + state.time * 2) * 0.2 * state.strength;
                finalInner.z += Math.cos(finalOuter.y * 5 + state.time * 2) * 0.2 * state.strength;
            } else if (state.modifier === 'magnetic') {
                const pull = new THREE.Vector3(Math.sin(state.time), Math.cos(state.time), 0).multiplyScalar(2);
                const dist = finalOuter.distanceTo(pull);
                const force = Math.max(0, (1.5 - dist) / 1.5) * state.strength;
                finalOuter.lerp(pull, force);
                finalInner.lerp(pull, force);
            } else if (state.modifier === 'explode') {
                // Face-based normal push
                const facePush = baseNormal.clone().multiplyScalar(state.strength * 1.5);
                finalOuter.add(facePush);
                finalInner.add(facePush);
            }

            outerVerts.push(finalOuter);
            innerVerts.push(finalInner);
            outerVisible.push(result.visible);
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

            // Tearing logic: Skip if any vertex is hidden
            if (!outerVisible[a] || !outerVisible[b] || !outerVisible[c] || !outerVisible[d]) continue;

            const ao = a + innerOffset;
            const bo = b + innerOffset;
            const co = c + innerOffset;
            const do_ = d + innerOffset;

            // Explosion Logic: Move indices away from face center
            if (state.modifier === 'explode') {
                const center = new THREE.Vector3()
                    .add(outerVerts[a]).add(outerVerts[b]).add(outerVerts[c]).add(outerVerts[d])
                    .multiplyScalar(0.25);
                const dir = center.clone().normalize().multiplyScalar(state.strength * 0.5);

                // We actually need to duplicate vertices to explode properly, 
                // but for simple visual we can just move the indices but it's shared.
                // Let's stick to simple face expansion if possible.
                // Instead of moving vertices (which are shared), we just add "None" for now as it needs a mesh rebuild.
                // Actually, let's just use the displacement to push the whole thing.
            }

            // Outer Surface (CCW)
            indices.push(a, b, d);
            indices.push(b, c, d);

            // Inner Surface (CW)
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

    // --- Side Walls / Capping (CRITICAL FOR 3D PRINTING) ---
    // This connects the Outer shell to the Inner shell to create "Solid Walls"

    // 1. Vertical Boundaries (Sides of Plane or Start/End of Wedge)
    if (state.splitCount > 1 || state.primitive === 'plane') {
        for (let iy = 0; iy < gridY; iy++) {
            // Left Edge (ix = 0)
            const t_out_l = iy * (gridX + 1);
            const b_out_l = (iy + 1) * (gridX + 1);
            const t_in_l = t_out_l + innerOffset;
            const b_in_l = b_out_l + innerOffset;
            indices.push(t_out_l, b_out_l, t_in_l);
            indices.push(b_out_l, b_in_l, t_in_l);

            // Right Edge (ix = gridX)
            const t_out_r = iy * (gridX + 1) + gridX;
            const b_out_r = (iy + 1) * (gridX + 1) + gridX;
            const t_in_r = t_out_r + innerOffset;
            const b_in_r = b_out_r + innerOffset;
            indices.push(t_out_r, t_in_r, b_out_r);
            indices.push(b_out_r, t_in_r, b_in_r);
        }
    }

    // 2. Horizontal Boundaries (Top/Bottom of Cylinder or Plane or Ashtray)
    if (state.primitive === 'cylinder' || state.primitive === 'plane' || state.primitive === 'ashtray') {
        for (let ix = 0; ix < gridX; ix++) {
            // "Bottom" Edge (iy = 0 - though for ashtray this is center floor)
            // But we actually only care about the open vertices at ix/iy limits

            // For Ashtray, the center floor (v=1) and center bottom (v=0??) need capping?
            // Actually the topology I built for ashtray is a closed loops in U (angle), 
            // but the V ends (v=0 and v=1) are the center of the bottom and center of the bowl floor.
            // These are singular points. Like a sphere's pole.
            // So they don't need "capping" between shells if they converge.

            // HOWEVER, if the primitive is ashtray, we need to CLOSE the bottom if it's not a full volume.
            // My ashtray map creates a hollow-like bowl.

            const l_out_t = ix;
            const r_out_t = ix + 1;
            const l_in_t = l_out_t + innerOffset;
            const r_in_t = r_out_t + innerOffset;
            indices.push(l_out_t, l_in_t, r_out_t);
            indices.push(r_out_t, l_in_t, r_in_t);

            const l_out_b = gridY * (gridX + 1) + ix;
            const r_out_b = gridY * (gridX + 1) + ix + 1;
            const l_in_b = l_out_b + innerOffset;
            const r_in_b = r_out_b + innerOffset;
            indices.push(l_out_b, r_out_b, l_in_b);
            indices.push(r_out_b, r_in_b, l_in_b);
        }
    }
    // If splitCount == 1, we leave them unconnected.

    // Calculate Geometry
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufferGeometry.setIndex(indices);
    bufferGeometry.computeVertexNormals();

    // Material Configuration
    let material;
    if (state.materialType === 'wireframe') {
        material = new THREE.MeshBasicMaterial({
            color: state.color,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
    } else if (state.materialType === 'points') {
        material = new THREE.PointsMaterial({
            color: state.color,
            size: 0.02,
            sizeAttenuation: true
        });
    } else if (state.materialType === 'glass') {
        material = new THREE.MeshPhysicalMaterial({
            color: state.color,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 0.5,
            ior: 1.5,
            transparent: true
        });
    } else {
        material = new THREE.MeshStandardMaterial({
            color: state.color,
            roughness: state.roughness,
            metalness: state.metalness,
            side: THREE.DoubleSide,
            flatShading: false
        });
    }

    if (state.materialType === 'points') {
        mesh = new THREE.Points(bufferGeometry, material);
    } else {
        mesh = new THREE.Mesh(bufferGeometry, material);
    }

    scene.add(mesh);
}

// --- Updates ---
function updateGeometry() {
    createCustomGeometry(); // Full regeneration needed for thickness/splitting changes
}

const themeSelect = document.getElementById('theme-select');
const colorPicker = document.getElementById('color-picker');
const materialSelect = document.getElementById('material-select');
const roughnessSlider = document.getElementById('roughness-slider');
const metalnessSlider = document.getElementById('metalness-slider');
const rotationSlider = document.getElementById('rotation-slider');
const ambientSlider = document.getElementById('ambient-slider');
const keyLightSlider = document.getElementById('key-light-slider');

const primitiveSelect = document.getElementById('primitive-select');
const modifierSelect = document.getElementById('modifier-select');
const mathModeSelect = document.getElementById('math-mode-select');
const timeSlider = document.getElementById('time-slider');
const strengthSlider = document.getElementById('strength-slider');
const resolutionSlider = document.getElementById('resolution-slider');
const thicknessSlider = document.getElementById('thickness-slider');
const splitSelect = document.getElementById('split-select');
const pieceGroup = document.getElementById('piece-group');
const pieceSelect = document.getElementById('piece-select');
const exportBtn = document.getElementById('export-btn');

primitiveSelect.addEventListener('change', (e) => {
    state.primitive = e.target.value;
    updateGeometry();
});

modifierSelect.addEventListener('change', (e) => {
    state.modifier = e.target.value;
    updateGeometry();
});

function applyTheme() {
    if (state.theme === 'light') {
        scene.background = new THREE.Color(0xffffff);
    } else {
        scene.background = new THREE.Color(0x111111);
    }
    updateLights();
}

function updateLights() {
    ambientLight.intensity = state.ambientIntensity;
    directionalLight.intensity = state.keyLightIntensity;
    fillLight.intensity = state.keyLightIntensity * 0.5; // Always keep fill proportional
}

themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    applyTheme();
});

ambientSlider.addEventListener('input', (e) => {
    state.ambientIntensity = parseFloat(e.target.value);
    updateLights();
});

keyLightSlider.addEventListener('input', (e) => {
    state.keyLightIntensity = parseFloat(e.target.value);
    updateLights();
});

colorPicker.addEventListener('input', (e) => {
    state.color = e.target.value;
    updateGeometry();
});

materialSelect.addEventListener('change', (e) => {
    state.materialType = e.target.value;
    updateGeometry();
});

roughnessSlider.addEventListener('input', (e) => {
    state.roughness = parseFloat(e.target.value);
    updateGeometry();
});

metalnessSlider.addEventListener('input', (e) => {
    state.metalness = parseFloat(e.target.value);
    updateGeometry();
});

rotationSlider.addEventListener('input', (e) => {
    state.rotationSpeed = parseFloat(e.target.value);
});

mathModeSelect.addEventListener('change', (e) => {
    state.mathMode = e.target.value;
    updateGeometry();
});

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
applyTheme(); // Ensure initial state matches theme
updateGeometry();

function animate() {
    requestAnimationFrame(animate);

    if (mesh) {
        mesh.rotation.y += 0.005 * state.rotationSpeed;
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();
