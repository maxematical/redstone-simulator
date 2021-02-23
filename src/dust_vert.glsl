#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aUv;
layout (location = 2) in float aPower;

uniform mat4 mvp;

out vec2 uv;
out float power;

void main()
{
    gl_Position = mvp * vec4(aPos, 1.0);
    uv = aUv;
    power = aPower;
}