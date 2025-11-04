precision mediump float;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uTextureMatrix0;

uniform float uAspectRatio;
uniform float uTime;
uniform float uScrollVelocity;
uniform float uMouseEnter;
uniform vec2 uMouseOverPos;

varying vec3 vVertexPosition;
varying vec2 vOriginalTextureCoord;
varying vec2 vTextureCoord;

void main() {
  vec3 vertexPosition = aVertexPosition;

  gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);

  vVertexPosition = vertexPosition;
  vOriginalTextureCoord = aTextureCoord;
  vTextureCoord = (uTextureMatrix0 * vec4(aTextureCoord, 0.0, 1.0)).xy;
}