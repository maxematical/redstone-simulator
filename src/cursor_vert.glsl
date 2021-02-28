#version 300 es

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aUv;
layout (location = 2) in float faceNum;

uniform mat4 mvp;
uniform vec3 cursorPos;
uniform float cursorSize;
uniform float renderFaces[6];

out highp vec2 uv;

void main()
{
    gl_Position = mvp * vec4((aPos - 0.5) * cursorSize + 0.5 + cursorPos, 1.0);
    uv = aUv;

    float shouldShowFace = renderFaces[int(faceNum)];
    gl_Position *= shouldShowFace;
}
