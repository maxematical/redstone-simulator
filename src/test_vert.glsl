#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in float aFaceNum;

uniform mat4 mvp;

out highp float faceNum;

void main()
{
    gl_Position = mvp * vec4(aPos, 1.0);
    faceNum = aFaceNum;
}