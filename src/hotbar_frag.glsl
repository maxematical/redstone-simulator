#version 300 es

precision lowp float;

out vec4 FragColor;

uniform highp vec4 uiPosition;
uniform highp vec4 cellParameters;
uniform highp float selectTime;

void main()
{
    float u_left = uiPosition.x;
    float u_bottom = uiPosition.y;
    float u_width = uiPosition.z;
    float u_height = uiPosition.w;

    float u_cellSize = cellParameters.x;
    float u_cellSpacing = cellParameters.y;
    float u_padding = cellParameters.z;
    float u_selectedIndex = cellParameters.w;

    float s = u_cellSize+u_cellSpacing;

    float ncells = floor( (u_width - 2.0*u_padding + u_cellSpacing)/s );

    vec2 off = gl_FragCoord.xy - vec2(u_left,u_bottom) - vec2(u_padding);
    float cellIndex = floor( off.x/s );
    // This variable is unused for now, but could be useful for reference
    bool inCell = (cellIndex >= 0.0 && off.x-cellIndex*s < u_cellSize &&
        cellIndex < ncells &&
        off.y >= 0.0 && off.y <= u_cellSize);

    vec4 col_yellow = vec4(0.90, 0.82, 0.20, 1.0);
    vec4 col_blue   = vec4(0.20, 0.73, 0.90, 1.0);

    // Usually a nice yellow color, but change to a blue color behind a selected object
    float bgTransition = clamp(selectTime*6.0, 0.0, 1.0);
    FragColor = mix(col_yellow, col_blue, float(
        abs(u_selectedIndex-cellIndex) < 0.01 &&    // u_selectedCellIndex == (the cellIndex of this pixel)
        off.x-cellIndex*s < u_cellSize &&           // pixel is not in the padding region of the cell
        abs(off.y - u_cellSize*0.5) < u_height*bgTransition
        ));
}
