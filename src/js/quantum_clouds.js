import * as THREE from 'three';

/**
 * Generates two point-cloud geometries representing Atomic Qubit states.
 * Uses Rejection Sampling to place points based on probability density functions.
 * 
 * @param {number} particleCount - Number of particles per cloud state.
 * @returns {object} { meshState0, meshState1 } - The generated meshes.
 */
export function createQuantumClouds(particleCount = 5000) {
    // --- Helper for Rejection Sampling ---
    // pdfFunc: (x, y, z) -> probability density [0, 1] (not necessarily normalized, just proportional)
    // bounds: { minX, maxX, minY, maxY, minZ, maxZ }
    // maxProb: approximate maximum value of pdfFunc in the bounds (for normalization efficiency)
    function generateCloud(count, pdfFunc, bounds, maxProb) {
        const positions = new Float32Array(count * 3);
        let validPoints = 0;

        while (validPoints < count) {
            // Random point in box
            const x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
            const y = Math.random() * (bounds.maxY - bounds.minY) + bounds.minY;
            const z = Math.random() * (bounds.maxZ - bounds.minZ) + bounds.minZ;

            // Calculate PDF value at this point
            const prob = pdfFunc(x, y, z);

            // Rejection check: prob / maxProb >= random(0,1)
            if (Math.random() * maxProb <= prob) {
                positions[validPoints * 3] = x;
                positions[validPoints * 3 + 1] = y;
                positions[validPoints * 3 + 2] = z;
                validPoints++;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return geometry;
    }

    // --- Cloud A: Ground State |0> ---
    // Math: psi = e^-r
    // Probability Density: |psi|^2 = e^-2r
    // Max value is at r=0 -> e^0 = 1.
    const pdfState0 = (x, y, z) => {
        const r = Math.sqrt(x * x + y * y + z * z);
        return Math.exp(-2 * r);
    };
    const boundsState0 = { minX: -5, maxX: 5, minY: -5, maxY: 5, minZ: -5, maxZ: 5 }; // Good coverage for fading exponentials

    const geo0 = generateCloud(particleCount, pdfState0, boundsState0, 1.0);
    const material0 = new THREE.PointsMaterial({
        color: 0x00ffff, // Cyan/Blue
        size: 0.15,      // Adjustable for "volumetric" look
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const meshState0 = new THREE.Points(geo0, material0);


    // --- Cloud B: Excited State |1> ---
    // Math: psi = r * e^(-r/2) * cos(theta)
    // Probability Density: |psi|^2 = r^2 * e^-r * cos^2(theta)
    // Coordinates: theta is angle from Z-axis in standard spherical coords, but we can align lobes along Y.
    // If lobes along Y: cos(theta_y) = y / r
    // Formula: r^2 * e^-r * (y/r)^2 = y^2 * e^-r
    // Peak probability: derivative of r^2 * e^-r is 0 at r=2.
    // Max value approx at r=2, y=2 -> 4 * e^-2 ≈ 0.54. Let's use maxProb = 0.6 safe upper bound.
    const pdfState1 = (x, y, z) => {
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r === 0) return 0;
        // Using Y-axis lobes
        // |psi|^2 = (r * e^(-r/2) * (y/r))^2 = y^2 * e^(-r)
        return (y * y) * Math.exp(-r);
    };
    const boundsState1 = { minX: -8, maxX: 8, minY: -8, maxY: 8, minZ: -8, maxZ: 8 };

    const geo1 = generateCloud(particleCount, pdfState1, boundsState1, 0.6);
    const material1 = new THREE.PointsMaterial({
        color: 0xff0033, // Red/Hot
        size: 0.15,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const meshState1 = new THREE.Points(geo1, material1);

    return { meshState0, meshState1 };
}
