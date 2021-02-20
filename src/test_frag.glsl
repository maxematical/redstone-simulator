#version 300 es

out highp vec4 FragColor;

in highp float faceNum;

void main()
{
    FragColor = vec4(vec3(faceNum / 8.0), .7);
}