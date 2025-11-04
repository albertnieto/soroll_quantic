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

  // entangled circles
  float circle1 = 1.0 - distance(vec2(0.3, 0.5), vTextureCoord) * 5.0;
  float circle2 = 1.0 - distance(vec2(0.7, 0.5), vTextureCoord) * 5.0;
  
  // entangled motion
  textureCoord.x += mix(0.0, 0.1, circle1 * sin(uTime));
  textureCoord.y += mix(0.0, 0.1, circle1 * cos(uTime));
  textureCoord.x += mix(0.0, 0.1, circle2 * sin(uTime + PI));
  textureCoord.y += mix(0.0, 0.1, circle2 * cos(uTime + PI));

  gl_FragColor = texture2D(uSampler0, textureCoord);
}