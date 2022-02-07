#version 300 es

precision highp float;

out vec4 FragColor;

uniform vec4 uiPosition;
uniform vec4 cellParameters;

void main()
{
    float u_left = uiPosition.x;
    float u_bottom = uiPosition.y;
    float u_width = uiPosition.z;

    float u_cellSize = cellParameters.x;
    float u_cellSpacing = cellParameters.y;
    float u_padding = cellParameters.z;
    float u_selectedIndex = cellParameters.w;

    float s = u_cellSize+u_cellSpacing;

    float ncells = floor( (u_width - 2.0*u_padding + u_cellSpacing)/s );

    vec2 off = gl_FragCoord.xy - vec2(u_left,u_bottom) - vec2(u_padding);
    float cellIndex = floor( off.x/s );
    // This variable is unused, but could be useful for reference
    bool inCell = (cellIndex >= 0.0 && off.x-cellIndex*s < u_cellSize &&
        cellIndex < ncells &&
        off.y >= 0.0 && off.y <= u_cellSize);

    // Normally a nice yellow color
    FragColor = vec4(0.90, 0.82, 0.20, 1.0);
    // Change background to a blue color behind a selected object
    FragColor = mix(FragColor, vec4(0.20, 0.73, 0.90, 1.0), float(
        abs(u_selectedIndex-cellIndex) < 0.01 && off.x-cellIndex*s < u_cellSize));
}
