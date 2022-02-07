#version 300 es

precision highp float;

layout (location = 0) in vec3 aPos;

uniform vec2 screenDimensions;
uniform vec4 uiPosition;

void main()
{
    vec2 offsetXY = uiPosition.xy / screenDimensions;
    vec2 scaleXY = uiPosition.zw / screenDimensions;
    vec2 xy = offsetXY + aPos.xy*scaleXY;
    gl_Position = vec4(2.0*xy - 1.0, 0.0, 1.0);
}
