// Ported from GLSL 'cnoise' in shaders.js to ensure exact visual match.
// This is Classic Perlin Noise (Improved version with quintic fade).

const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

// Standard permutation table
const p = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
    p[i] = i;
}
// Shuffle
for (let i = 255; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [p[i], p[r]] = [p[r], p[i]];
}
// Double it
for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
}

function fade(t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function lerp(a, b, t) {
    return (1.0 - t) * a + t * b;
}

function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// 3D Perlin Noise
export function cnoise(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    return lerp(
        lerp(
            lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
            lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
            v
        ),
        lerp(
            lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
            lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
            v
        ),
        w
    );
}
