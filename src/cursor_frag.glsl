#version 300 es

out highp vec4 FragColor;

in highp vec2 uv;

uniform highp float time;
uniform sampler2D tex;

void main()
{
    FragColor = texture(tex, uv * 0.125);
    FragColor.a = sin(time * 12.0) * 0.025 + 0.2;
}