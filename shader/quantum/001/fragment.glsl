precision mediump float;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

uniform sampler2D uSampler0;
uniform float uAspectRatio;
uniform float uTime;
uniform float uScrollVelocity;
uniform float uMouseEnter;
uniform vec2 uMouseOverPos;

varying vec3 vVertexPosition;
varying vec2 vOriginalTextureCoord;
varying vec2 vTextureCoord;

void main() {
  vec2 textureCoord = vTextureCoord;
  vec2 center = vec2(0.5);
  
  // quantum superposition wave function
  float r = distance(center, vTextureCoord);
  float theta = atan(vTextureCoord.y - center.y, vTextureCoord.x - center.x);
  
  // probability amplitude |ψ|²
  float psi = sin(r * 10.0 - uTime * 3.0) * exp(-r * 2.0);
  float probability = psi * psi;
  
  // quantum interference pattern
  float interference = cos(theta * 4.0 + uTime) * probability;
  
  // apply quantum distortion
  textureCoord.x += interference * 0.05 * sin(uTime * 2.0);
  textureCoord.y += interference * 0.05 * cos(uTime * 2.0);
  
  vec4 color = texture2D(uSampler0, textureCoord);
  
  // quantum glow effect
  color.rgb += vec3(probability * 0.3, interference * 0.2, probability * interference * 0.4);
  
  gl_FragColor = color;
}