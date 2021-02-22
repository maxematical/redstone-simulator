#version 300 es

precision highp int;
precision highp float;

out highp vec4 FragColor;

in highp vec2 uv;

uniform highp float alpha;
uniform sampler2D tex;

void main()
{
    vec2 localUv = uv - floor(uv);
    vec2 intUv = floor(uv);

    // Change this if we ever resize the texture!!!
    // This represents the size in pixels of each individual block texture in the atlas
    float CELL_SIZE = 8.0;

    float clampTo = 0.5 / CELL_SIZE;
    localUv = clamp(localUv, clampTo, 1.0 - clampTo);

    FragColor = texture(tex, (localUv + intUv) * 0.125);
    FragColor.a *= alpha;
}
