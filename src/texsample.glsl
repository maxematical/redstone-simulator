// Special texture sampling algorithm that avoids texture-atlas artifacts by
// avoiding sampling UVs that are closer than 0.5 pixels to the edge

precision highp float;

vec4 texSample(sampler2D s, vec2 uv)
{
    vec2 localUv = uv - floor(uv);
    vec2 intUv = floor(uv);

    // This represents the size in pixels of each individual block texture in the atlas
    // Change this if we ever resize the textures!!!
    float CELL_SIZE = 8.0;

    float clampTo = 0.5 / CELL_SIZE;
    localUv = clamp(localUv, clampTo, 1.0 - clampTo);

    vec4 col = texture(s, (localUv + intUv) * 0.125);

    // TODO Render transparent blocks in another pass to reduce discards
    if (col.a < 0.1) discard;
    return col;
}
#pragma glslify: export(texSample)
