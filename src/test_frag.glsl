#version 300 es

out highp vec4 FragColor;

in highp vec2 uv;

uniform highp float alpha;
uniform sampler2D tex;

void main()
{
    FragColor = texture(tex, uv * 0.25);
    FragColor.a = alpha;
}