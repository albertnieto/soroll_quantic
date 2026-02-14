
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

// ============================================================================
// SHADERS (Directly from library)
// ============================================================================

const godraysVertexShader = `
varying vec2 vUv;
void main() {
	vUv = position.xy * 0.5 + 0.5;
	gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const godraysFragmentShader = `
varying vec2 vUv;

uniform sampler2D sceneDepth;
uniform vec3 lightPos;
uniform vec3 cameraPos;
uniform vec2 resolution;
uniform mat4 cameraProjectionMatrixInv;
uniform mat4 cameraMatrixWorld;
#if defined(USE_CUBE_SHADOWMAP)
uniform samplerCube shadowMap;
#else
uniform sampler2D shadowMap;
#endif
uniform float texelSizeY;
uniform float lightCameraNear;
uniform float lightCameraFar;
uniform float near;
uniform float far;
uniform float density;
uniform float maxDensity;
uniform float distanceAttenuation;
uniform vec3[6] fNormals;
uniform float[6] fConstants;
uniform float raymarchSteps;
uniform float raymarchStepSize;
uniform float minSteps;
uniform float maxSteps;
uniform float shadowTexelWorldSize;
uniform mat4 premultipliedLightCameraMatrix;

#include <packing>

float linearize_depth(float depth, float zNear, float zFar) {
  #if defined( USE_LOGDEPTHBUF )
  float d = pow(2.0, depth * log2(zFar + 1.0)) - 1.0;
  float a = zFar / (zFar - zNear);
  float b = zFar * zNear / (zNear - zFar);
  depth = a + b / d;
  #endif

  return zNear * zFar / (zFar + depth * (zNear - zFar));
}

vec3 WorldPosFromDepth(float depth, vec2 coord) {
  #if defined( USE_LOGDEPTHBUF )
  float d = pow(2.0, depth * log2(far + 1.0)) - 1.0;
  float a = far / (far - near);
  float b = far * near / (near - far);
  depth = a + b / d;
  #endif

  float z = depth * 2.0 - 1.0;
  vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
  vec4 viewSpacePosition = cameraProjectionMatrixInv * clipSpacePosition;
  viewSpacePosition /= viewSpacePosition.w;
  vec4 worldSpacePosition = cameraMatrixWorld * viewSpacePosition;
  return worldSpacePosition.xyz;
}

vec2 cubeToUV(vec3 v) {
  vec3 absV = abs(v);
  float scaleToCube = 1.0 / max(absV.x, max(absV.y, absV.z));
  absV *= scaleToCube;
  v *= scaleToCube * (1.0 - 2.0 * texelSizeY);
  vec2 planar = v.xy;
  float almostATexel = 1.5 * texelSizeY;
  float almostOne = 1.0 - almostATexel;
  if (absV.z >= almostOne) {
    if (v.z > 0.0)
      planar.x = 4.0 - v.x;
  } else if (absV.x >= almostOne) {
    float signX = sign(v.x);
    planar.x = v.z * signX + 2.0 * signX;
  } else if (absV.y >= almostOne) {
    float signY = sign(v.y);
    planar.x = v.x + 2.0 * signY + 2.0;
    planar.y = v.z * signY - 2.0;
  }
  return vec2(0.125, 0.25) * planar + vec2(0.375, 0.75);
}

vec3 projectToShadowMap(vec3 worldPos) {
  vec4 lightSpacePos = premultipliedLightCameraMatrix * vec4(worldPos, 1.0);
  lightSpacePos /= lightSpacePos.w;
  lightSpacePos = lightSpacePos * 0.5 + 0.5;
  return lightSpacePos.xyz;
}

vec2 inShadow(vec3 worldPos) {
  #if defined(USE_CUBE_SHADOWMAP)
  vec3 lightToPos = worldPos - lightPos;
  float lightDist = length(lightToPos);
  
  #if defined(USE_UNPACKED_DEPTH)
  float shadowMapDepth = textureCube(shadowMap, lightToPos).r;
  #else
  // For older Three.js (0.160), Cube ShadowMaps are packed RGBA
  vec4 packedCubeDepth = textureCube(shadowMap, lightToPos);
  float shadowMapDepth = unpackRGBAToDepth(packedCubeDepth);
  #endif

  float depth = lightCameraNear + (lightCameraFar - lightCameraNear) * shadowMapDepth;
  return vec2(float(lightDist > depth + 0.005), lightDist);
  #else

  #if defined(IS_POINT_LIGHT)
  vec2 shadowMapUV = cubeToUV(normalize(worldPos - lightPos));
  #elif defined(IS_DIRECTIONAL_LIGHT)
  vec3 shadowMapUV = projectToShadowMap(worldPos);
  bool isOutsideShadowMap = shadowMapUV.x < 0.0 || shadowMapUV.x > 1.0 || shadowMapUV.y < 0.0 || shadowMapUV.y > 1.0 || shadowMapUV.z < 0.0 || shadowMapUV.z > 1.0;
  if (isOutsideShadowMap) {
    return vec2(1.0, 0.0);
  }
  #endif

  vec4 packedDepth = texture2D(shadowMap, shadowMapUV.xy);
  #if defined( USE_UNPACKED_DEPTH )
  #if defined(IS_DIRECTIONAL_LIGHT)
  float depth = packedDepth.x;
  #else
  float depth = 1. - packedDepth.x;
  #endif
  #else
  float depth = unpackRGBAToDepth(packedDepth);
  #endif

  depth = lightCameraNear + (lightCameraFar - lightCameraNear) * depth;
  #if defined(IS_POINT_LIGHT)
  float lightDist = distance(worldPos, lightPos);
  #elif defined(IS_DIRECTIONAL_LIGHT)
  float lightDist = (lightCameraNear + (lightCameraFar - lightCameraNear) * shadowMapUV.z);
  #endif
  float difference = lightDist - depth;
  return vec2(float(difference > 0.0), lightDist);
  #endif
}

float sdPlane(vec3 p, vec3 n, float h) {
  return dot(p, n) + h;
}

void main() {
  float depth = texture2D(sceneDepth, vUv).x;
  float linearDepth = linearize_depth(depth, near, far);

  vec3 worldPos = WorldPosFromDepth(depth, vUv);
  vec3 direction = normalize(worldPos - cameraPos);
  float distToTarget = distance(worldPos, cameraPos);

  float tEntry = 0.0;
  float tExit = distToTarget;
  bool missed = false;
  for (int i = 0; i < 6; i++) {
    float denom = dot(fNormals[i], direction);
    float dist = sdPlane(cameraPos, fNormals[i], fConstants[i]);

    if (abs(denom) < 1e-6) {
      if (dist > 0.0) {
        missed = true;
        break;
      }
    } else {
      float t = -dist / denom;
      if (denom < 0.0) {
        tEntry = max(tEntry, t);
      } else {
        tExit = min(tExit, t);
      }
    }
  }

  if (missed || tEntry >= tExit) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, linearDepth);
    return;
  }

  float startOffset = tEntry > 0.0 ? 0.001 : 0.0;
  vec3 startPos = cameraPos + (tEntry + startOffset) * direction;
  worldPos = cameraPos + tExit * direction;
  float illum = 0.0;
  float rayLength = distance(startPos, worldPos);
  float densityFactor = rayLength * density;

  float baseSteps;
  if (raymarchStepSize > 0.0) {
    float effectiveStepSize = max(raymarchStepSize, shadowTexelWorldSize * 0.5);
    baseSteps = clamp(rayLength / effectiveStepSize, minSteps, maxSteps);
  } else {
    baseSteps = raymarchSteps;
  }

  float noise = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
  float samplesFloat = round(baseSteps + ((baseSteps / 8.0) + 2.0) * noise);
  int samples = int(samplesFloat);
  float earlyOutThreshold = -log(1.0 - maxDensity) * samplesFloat;
  int stepsTaken = samples;
  for (int i = 0; i < samples; i++) {
    vec3 samplePos = mix(startPos, worldPos, float(i) / samplesFloat);
    vec2 shadowInfo = inShadow(samplePos);
    float shadowAmount = 1.0 - shadowInfo.x;
    illum += shadowAmount * densityFactor * pow(1.0 - shadowInfo.y / lightCameraFar, distanceAttenuation);
    if (illum > earlyOutThreshold) {
      stepsTaken = i + 1;
      break;
    }
  }
  illum /= samplesFloat;

  #if defined(DEBUG_STEPS)
  float t = clamp(float(stepsTaken) / 150.0, 0.0, 1.0);
  gl_FragColor = vec4(0.0, t, 0.0, linearDepth);
  #else
  gl_FragColor = vec4(vec3(clamp(1.0 - exp(-illum), 0.0, maxDensity)), linearDepth);
  #endif
}
`;

const compositorVertexShader = `
varying vec2 vUv;
void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const compositorFragmentShader = `
#include <common>

uniform sampler2D godrays;
uniform sampler2D sceneDiffuse;
uniform sampler2D sceneDepth;
uniform vec2 resolution;
uniform vec2 godraysResolution;
uniform float near;
uniform float far;
uniform vec3 color;
uniform bool gammaCorrection;
varying vec2 vUv;

float linearize_depth(float depth, float zNear, float zFar) {
  #if defined( USE_LOGDEPTHBUF )
  float d = pow(2.0, depth * log2(far + 1.0)) - 1.0;
  float a = far / (far - near);
  float b = far * near / (near - far);
  depth = a + b / d;
  #endif
  return zNear * zFar / (zFar + depth * (zNear - zFar));
}

// Joint Bilateral Upsampling settings
#define JBU_EXTENT 1
#define JBU_SPATIAL_SIGMA 1.0
#define JBU_DEPTH_SIGMA 0.02

void main() {
  float rawDepth = texture2D(sceneDepth, vUv).x;
  float correctDepth = linearize_depth(rawDepth, near, far);

  vec2 texelSize = 1.0 / godraysResolution;
  vec2 texelPos = vUv * godraysResolution - 0.5;
  vec2 base = floor(texelPos);
  vec2 f = texelPos - base;

  float totalWeight = 0.0;
  float totalIllum = 0.0;

  for (int y = -JBU_EXTENT; y <= 1 + JBU_EXTENT; y++) {
    for (int x = -JBU_EXTENT; x <= 1 + JBU_EXTENT; x++) {
      vec2 sampleUv = (base + vec2(float(x), float(y)) + 0.5) * texelSize;
      vec4 data = texture2D(godrays, sampleUv);
      float sampleDepth = data.a; 
      
      vec2 d = vec2(float(x), float(y)) - f;
      float spatialW = exp(-dot(d, d) / (2.0 * JBU_SPATIAL_SIGMA * JBU_SPATIAL_SIGMA));
      
      float depthDiff = (sampleDepth - correctDepth) / max(correctDepth, 0.001);
      float depthW = exp(-0.5 * depthDiff * depthDiff / (JBU_DEPTH_SIGMA * JBU_DEPTH_SIGMA));
      
      float w = spatialW * depthW;
      totalWeight += w;
      totalIllum += data.r * w;
    }
  }

  float bestChoice = totalWeight > 0.0 ? totalIllum / totalWeight : 0.0;
  vec4 diffuse = texture2D(sceneDiffuse, vUv);
  vec3 finalColor = diffuse.rgb + color * bestChoice;

  gl_FragColor = vec4(finalColor, diffuse.a);
}
`;


// ============================================================================
// HELPER CONSTANTS
// ============================================================================
const DIRECTIONS = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
];
const PLANES = DIRECTIONS.map(() => new THREE.Plane());
const SCRATCH_VECTOR = new THREE.Vector3();
const SCRATCH_VECTOR2 = new THREE.Vector3();
const SCRATCH_VECTOR3 = new THREE.Vector3();
const SCRATCH_FRUSTUM = new THREE.Frustum();
const SCRATCH_MAT4 = new THREE.Matrix4();

// ============================================================================
// MATERIAL CLASSES
// ============================================================================

class GodraysMaterial extends THREE.ShaderMaterial {
    constructor(light) {
        const uniforms = {
            density: { value: 1 / 128 },
            maxDensity: { value: 0.5 },
            distanceAttenuation: { value: 2 },
            sceneDepth: { value: null },
            lightPos: { value: new THREE.Vector3(0, 0, 0) },
            cameraPos: { value: new THREE.Vector3(0, 0, 0) },
            resolution: { value: new THREE.Vector2(1, 1) },
            premultipliedLightCameraMatrix: { value: new THREE.Matrix4() },
            cameraProjectionMatrixInv: { value: new THREE.Matrix4() },
            cameraMatrixWorld: { value: new THREE.Matrix4() },
            shadowMap: { value: null },
            texelSizeY: { value: 1 },
            lightCameraNear: { value: 0.1 },
            lightCameraFar: { value: 1000 },
            near: { value: 0.1 },
            far: { value: 1000.0 },
            fNormals: { value: DIRECTIONS.map(() => new THREE.Vector3()) },
            fConstants: { value: DIRECTIONS.map(() => 0) },
            raymarchSteps: { value: 60 },
            raymarchStepSize: { value: 0.0 },
            minSteps: { value: 8.0 },
            maxSteps: { value: 125.0 },
            shadowTexelWorldSize: { value: 0.0 },
        };

        const defines = {};
        if (light.isPointLight) {
            defines.IS_POINT_LIGHT = '';
            // Critical for Point Light Shadows:
            defines.USE_CUBE_SHADOWMAP = '';
        } else if (light.isDirectionalLight) {
            defines.IS_DIRECTIONAL_LIGHT = '';
        }
        const threeVersion = parseInt(THREE.REVISION);
        if (threeVersion >= 182) {
            defines.USE_UNPACKED_DEPTH = '';
        }

        super({
            name: 'GodraysMaterial',
            uniforms,
            fragmentShader: godraysFragmentShader,
            vertexShader: godraysVertexShader,
            defines: defines,
        });
    }
}

class GodraysCompositorMaterial extends THREE.ShaderMaterial {
    constructor({ godrays, color, camera, gammaCorrection }) {
        const uniforms = {
            godrays: { value: godrays },
            sceneDiffuse: { value: null },
            sceneDepth: { value: null },
            near: { value: 0.1 },
            far: { value: 1000.0 },
            color: { value: color },
            resolution: { value: new THREE.Vector2(1, 1) },
            godraysResolution: { value: new THREE.Vector2(1, 1) },
            gammaCorrection: { value: gammaCorrection ? 1 : 0 },
        };

        super({
            name: 'GodraysCompositorMaterial',
            uniforms,
            depthWrite: false,
            depthTest: false,
            fragmentShader: compositorFragmentShader,
            vertexShader: compositorVertexShader,
            defines: {
                JBU_EXTENT: "1",
                JBU_SPATIAL_SIGMA: "1.0",
                JBU_DEPTH_SIGMA: "0.02"
            },
        });

        this.updateUniforms(color, gammaCorrection, camera.near, camera.far);
    }

    updateUniforms(color, gammaCorrection, near, far) {
        this.uniforms.color.value = color;
        this.uniforms.near.value = near;
        this.uniforms.far.value = far;
        this.uniforms.gammaCorrection.value = gammaCorrection ? 1 : 0;
    }

    setSize(width, height) {
        this.uniforms.resolution.value.set(width, height);
    }

    setGodraysResolution(width, height) {
        this.uniforms.godraysResolution.value.set(width, height);
    }
}

// ============================================================================
// HELPER PASSES
// ============================================================================

class GodraysIllumPass extends Pass {
    constructor(props, params) {
        super();
        this.props = props;
        this.lastParams = params;
        this.material = new GodraysMaterial(props.light);
        this.lightWorldPos = new THREE.Vector3();
        this.needsDepthCopy = false;
        this.depthCopyTarget = null;
        this.originalShadowMap = null;
        this.shadowMapSet = false;

        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.quad.frustumCulled = false; // Avoid getting culled
        this.scene.add(this.quad);

        this.updateUniforms(props, params);
    }

    setSize(width, height) {
        this.material.uniforms.resolution.value.set(width, height);
        this.material.uniforms.near.value = this.props.camera.near;
        this.material.uniforms.far.value = this.props.camera.far;
    }

    render(renderer, inputBuffer, outputBuffer) {
        if (!this.shadowMapSet && this.props.light.shadow.map?.texture) {
            this.updateUniforms(this.props, this.lastParams);
            this.shadowMapSet = true;
            this.checkForDepthCopy(renderer);
        }
        this.updateLightParams(this.props);

        if (this.needsDepthCopy && this.originalShadowMap && this.depthCopyTarget) {
            this.copyDepthTexture(renderer);
            this.material.uniforms.shadowMap.value = this.depthCopyTarget.depthTexture;
        }

        renderer.setRenderTarget(outputBuffer);
        renderer.render(this.scene, this.camera);

        if (this.needsDepthCopy && this.originalShadowMap) {
            this.material.uniforms.shadowMap.value = this.originalShadowMap;
        }
    }

    copyDepthTexture(renderer) {
        const gl = renderer.getContext();
        const shadow = this.props.light.shadow;

        const shadowMapProps = renderer.properties.get(shadow.map);
        const srcFramebuffer = shadowMapProps.__webglFramebuffer;

        const copyTargetProps = renderer.properties.get(this.depthCopyTarget);
        let dstFramebuffer = copyTargetProps?.__webglFramebuffer;

        if (!dstFramebuffer) {
            renderer.setRenderTarget(this.depthCopyTarget);
            renderer.clear();
            renderer.setRenderTarget(null);
            const updatedProps = renderer.properties.get(this.depthCopyTarget);
            dstFramebuffer = updatedProps.__webglFramebuffer;
        }

        if (!srcFramebuffer || !dstFramebuffer) return;

        const width = shadow.map.width;
        const height = shadow.map.height;

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFramebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFramebuffer);
        gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    checkForDepthCopy(renderer) {
        const light = this.props.light;
        const isDirectionalOrSpot = light.isDirectionalLight || light.isSpotLight;

        if (!isDirectionalOrSpot) {
            this.needsDepthCopy = false;
            return;
        }

        const depthTexture = light.shadow.map?.depthTexture;
        const hasCompareFunction = depthTexture && depthTexture.compareFunction !== null;

        if (hasCompareFunction) {
            this.needsDepthCopy = true;
            this.originalShadowMap = depthTexture;

            const shadowMapSize = light.shadow.mapSize;
            this.depthCopyTarget = new THREE.WebGLRenderTarget(shadowMapSize.x, shadowMapSize.y);
            this.depthCopyTarget.depthTexture = new THREE.DepthTexture(
                shadowMapSize.x,
                shadowMapSize.y,
                THREE.UnsignedIntType
            );
            this.depthCopyTarget.depthTexture.format = THREE.DepthFormat;
            this.depthCopyTarget.depthTexture.compareFunction = null;
            this.depthCopyTarget.depthTexture.minFilter = THREE.NearestFilter;
            this.depthCopyTarget.depthTexture.magFilter = THREE.NearestFilter;
        } else {
            this.needsDepthCopy = false;
            this.originalShadowMap = null;
        }
    }

    setDepthTexture(depthTexture, depthPacking) {
        this.material.uniforms.sceneDepth.value = depthTexture;
    }

    computeEffectiveMaxDist(lightCameraFar, distanceAttenuation) {
        if (distanceAttenuation <= 0) return lightCameraFar;
        const epsilon = 0.005;
        return Math.min(
            lightCameraFar,
            lightCameraFar * (1.0 - Math.pow(epsilon, 1.0 / distanceAttenuation))
        );
    }

    updateLightParams({ light }) {
        light.getWorldPosition(this.lightWorldPos);

        const uniforms = this.material.uniforms;
        uniforms.premultipliedLightCameraMatrix.value.multiplyMatrices(
            light.shadow.camera.projectionMatrix,
            light.shadow.camera.matrixWorldInverse
        );

        if (light.isPointLight) {
            const effectiveFar = this.computeEffectiveMaxDist(
                uniforms.lightCameraFar.value,
                uniforms.distanceAttenuation.value
            );

            for (let i = 0; i < DIRECTIONS.length; i += 1) {
                const direction = DIRECTIONS[i];
                const plane = PLANES[i];

                SCRATCH_VECTOR.copy(light.position);
                SCRATCH_VECTOR.addScaledVector(direction, effectiveFar);
                plane.setFromNormalAndCoplanarPoint(direction, SCRATCH_VECTOR);

                uniforms.fNormals.value[i].copy(plane.normal);
                uniforms.fConstants.value[i] = plane.constant;
            }

            uniforms.shadowTexelWorldSize.value =
                (2.0 * uniforms.lightCameraFar.value) / light.shadow.mapSize.x;
        } else if (light.isDirectionalLight) {
            SCRATCH_MAT4.multiplyMatrices(
                light.shadow.camera.projectionMatrix,
                light.shadow.camera.matrixWorldInverse
            );
            SCRATCH_FRUSTUM.setFromProjectionMatrix(SCRATCH_MAT4);

            const effectiveFar = this.computeEffectiveMaxDist(
                uniforms.lightCameraFar.value,
                uniforms.distanceAttenuation.value
            );
            if (effectiveFar < uniforms.lightCameraFar.value) {
                light.shadow.camera.getWorldDirection(SCRATCH_VECTOR2);
                light.shadow.camera.getWorldPosition(SCRATCH_VECTOR3);
                SCRATCH_VECTOR.copy(SCRATCH_VECTOR3).addScaledVector(SCRATCH_VECTOR2, effectiveFar);
                SCRATCH_VECTOR2.negate();
                SCRATCH_FRUSTUM.planes[4].setFromNormalAndCoplanarPoint(SCRATCH_VECTOR2, SCRATCH_VECTOR);
            }

            for (let planeIx = 0; planeIx < 6; planeIx += 1) {
                const plane = SCRATCH_FRUSTUM.planes[planeIx];
                uniforms.fNormals.value[planeIx].copy(plane.normal).multiplyScalar(-1);
                uniforms.fConstants.value[planeIx] = plane.constant * -1;
            }

            const shadowCam = light.shadow.camera;
            uniforms.shadowTexelWorldSize.value =
                (shadowCam.right - shadowCam.left) / light.shadow.mapSize.x;
        }
    }

    updateUniforms(props, params) {
        const shadow = props.light.shadow;
        let shadowMap = shadow.map?.texture ?? null;
        if (props.light.isDirectionalLight && shadow.map?.depthTexture) {
            shadowMap = shadow.map.depthTexture;
        }

        // Handle Cube Texture for Point Lights
        if (shadowMap && (shadowMap.isCubeTexture || props.light.isPointLight)) {
            if (this.material.defines.USE_CUBE_SHADOWMAP === undefined) {
                this.material.defines.USE_CUBE_SHADOWMAP = '';
                this.material.needsUpdate = true;
            }
        } else {
            if (this.material.defines.USE_CUBE_SHADOWMAP !== undefined) {
                delete this.material.defines.USE_CUBE_SHADOWMAP;
                this.material.needsUpdate = true;
            }
        }

        const mapSize = shadow.map?.height ?? 1;

        const uniforms = this.material.uniforms;
        uniforms.density.value = params.density;
        uniforms.maxDensity.value = params.maxDensity;
        uniforms.lightPos.value = this.lightWorldPos;
        uniforms.cameraPos.value = props.camera.position;
        uniforms.cameraProjectionMatrixInv.value = props.camera.projectionMatrixInverse;
        uniforms.cameraMatrixWorld.value = props.camera.matrixWorld;
        uniforms.shadowMap.value = shadowMap;
        uniforms.texelSizeY.value = 1 / (mapSize * 2);
        uniforms.lightCameraNear.value = shadow?.camera.near ?? 0.1;
        uniforms.lightCameraFar.value = shadow?.camera.far ?? 1000;
        uniforms.near.value = props.camera.near;
        uniforms.far.value = props.camera.far;
        uniforms.distanceAttenuation.value = params.distanceAttenuation;
        uniforms.raymarchSteps.value = params.raymarchSteps;
        uniforms.raymarchStepSize.value = 0.0;
    }
}

class GodraysCompositorPass extends Pass {
    constructor(props) {
        super();
        this.sceneCamera = props.camera;
        this.fullscreenMaterial = new GodraysCompositorMaterial(props);

        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fullscreenMaterial);
        this.quad.frustumCulled = false;
        this.scene.add(this.quad);

        this.depthCopyRenderTexture = null;
        this.depthTextureCopyPass = null;
    }

    updateUniforms(params) {
        this.fullscreenMaterial.updateUniforms(
            params.color,
            params.gammaCorrection,
            this.sceneCamera.near,
            this.sceneCamera.far
        );
    }

    render(renderer, inputBuffer, outputBuffer) {
        this.fullscreenMaterial.uniforms.sceneDiffuse.value = inputBuffer.texture;

        const sceneDepth = this.fullscreenMaterial.uniforms.sceneDepth.value;
        // Workaround for same depth texture issue
        if (sceneDepth && outputBuffer && outputBuffer.depthTexture && sceneDepth === outputBuffer.depthTexture) {
            if (!this.depthCopyRenderTexture) {
                this.depthCopyRenderTexture = new THREE.WebGLRenderTarget(
                    outputBuffer.depthTexture.image.width,
                    outputBuffer.depthTexture.image.height,
                    {
                        minFilter: THREE.NearestFilter,
                        magFilter: THREE.NearestFilter,
                        format: THREE.RGBAFormat,
                        type: THREE.FloatType // High precision needed for depth
                    }
                );
            }
            if (!this.depthTextureCopyPass) {
                this.depthTextureCopyPass = new ShaderPass(CopyShader);
                this.depthTextureCopyPass.textureID = "ignoreMe"; // Prevent auto-setting tDiffuse
            }
            this.depthTextureCopyPass.uniforms['tDiffuse'].value = sceneDepth;
            this.depthTextureCopyPass.render(renderer, this.depthCopyRenderTexture, inputBuffer); // Pass valid readBuffer to avoid crash
            this.fullscreenMaterial.uniforms.sceneDepth.value = this.depthCopyRenderTexture.texture;
        }

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(outputBuffer);
        }
        renderer.render(this.scene, this.camera);

        this.fullscreenMaterial.uniforms.sceneDepth.value = sceneDepth;
    }

    setDepthTexture(depthTexture) {
        this.fullscreenMaterial.uniforms.sceneDepth.value = depthTexture;
    }

    setSize(width, height) {
        this.fullscreenMaterial.setSize(width, height);
    }

    setGodraysResolution(width, height) {
        this.fullscreenMaterial.setGodraysResolution(width, height);
    }
}

// ============================================================================
// MAIN PASS CLASS
// ============================================================================

export class GodraysPass extends Pass {
    constructor(light, camera, partialParams = {}) {
        super();
        this.props = { light, camera };
        this.lastParams = {
            density: 1.0 / 128.0,
            maxDensity: 0.5,
            distanceAttenuation: 2.0,
            color: new THREE.Color(0xffffff),
            raymarchSteps: 60,
            blur: true,
            gammaCorrection: true,
            resolutionScale: 0.5,
            ...partialParams
        };

        // Allow public access to params
        this.params = this.lastParams;

        this.godraysMaterial = null; // Will be set from IllumPass

        this.godraysRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            generateMipmaps: false,
        });

        this.illumPass = new GodraysIllumPass(this.props, this.lastParams);
        this.illumPass.needsDepthTexture = true;
        this.godraysMaterial = this.illumPass.material; // Expose for main.js access

        this.compositorPass = new GodraysCompositorPass({
            godrays: this.godraysRenderTarget.texture,
            color: this.lastParams.color,
            camera: camera,
            gammaCorrection: this.lastParams.gammaCorrection,
        });
        this.compositorPass.needsDepthTexture = true;

        this.needsDepthTexture = true;
        this.setSize(window.innerWidth, window.innerHeight);
    }

    setParams(partialParams) {
        this.lastParams = { ...this.lastParams, ...partialParams };
        this.illumPass.updateUniforms(this.props, this.lastParams);
        this.compositorPass.updateUniforms(this.lastParams);
    }

    setSize(width, height) {
        this.lastWidth = width;
        this.lastHeight = height;
        const scale = this.lastParams.resolutionScale || 0.5;
        const godraysWidth = Math.ceil(width * scale);
        const godraysHeight = Math.ceil(height * scale);

        this.godraysRenderTarget.setSize(godraysWidth, godraysHeight);
        this.illumPass.setSize(godraysWidth, godraysHeight);
        this.compositorPass.setSize(width, height);
        this.compositorPass.setGodraysResolution(godraysWidth, godraysHeight);
    }

    render(renderer, writeBuffer, readBuffer) {
        // [FIX] Update light and uniforms every frame to capture movement and shadow map changes
        this.illumPass.updateLightParams(this.props);
        this.illumPass.updateUniforms(this.props, this.lastParams);

        // 1. Render Godrays to offscreen target
        this.illumPass.render(renderer, readBuffer, this.godraysRenderTarget);

        // 2. Blur (Skipped for simplicity in this port, or could add Bilateral here too)
        // For now, straight to composition.

        // 3. Composite
        this.compositorPass.renderToScreen = this.renderToScreen;
        this.compositorPass.render(renderer, readBuffer, writeBuffer);
    }

    setDepthTexture(depthTexture, depthPacking) {
        this.illumPass.setDepthTexture(depthTexture, depthPacking);
        this.compositorPass.setDepthTexture(depthTexture, depthPacking);
    }
}
