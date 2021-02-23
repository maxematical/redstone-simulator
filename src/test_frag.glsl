#version 300 es
#pragma glslify: texSample = require(./texSample.glsl)

precision highp float;

out highp vec4 FragColor;

in highp vec2 uv;

uniform highp float alpha;
uniform sampler2D tex;

void main()
{
    FragColor = texSample(tex, uv);
    FragColor.a *= alpha;
}
