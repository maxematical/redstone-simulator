#version 300 es
#pragma glslify: texSample = require(./texsample.glsl)

precision highp float;

in vec2 uv;
in float power;

uniform float alpha;
uniform sampler2D tex;

out vec4 FragColor;

void main()
{
    FragColor = texSample(tex, uv);
    FragColor.rgb *= power;
    FragColor.a *= alpha;
}
