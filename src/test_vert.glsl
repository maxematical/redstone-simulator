#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aUv;

uniform mat4 mvp;

out vec2 uv;

void main()
{
    gl_Position = mvp * vec4(aPos, 1.0);
    uv = aUv;
}