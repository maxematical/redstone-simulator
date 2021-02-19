import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';
import { Grid } from './grid';

var canvas: HTMLCanvasElement = null;
var gl: WebGL2RenderingContext = null;
var grid: Grid = Grid.new([1, 1, 1]);

const maximizeCanvas = () => {
    const body = document.querySelector('body');
    canvas.width = body.offsetWidth;
    canvas.height = body.offsetHeight;
};

const initShader = (name: string, src: string, type: number): WebGLShader => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(`Error compiling shader ${name}`, gl.getShaderInfoLog(shader));
        alert(`Shader compilation error: ${name}`);
        return null;
    }
    return shader;
};

const initProgram = (vert: WebGLShader, frag: WebGLShader): WebGLProgram => {
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log('Error linking program', gl.getProgramInfoLog(program));
        alert('Program linkage error');
        return null;
    }
    return program;
};

window.onload = () => {
    document.getElementById('status-message').innerHTML = '';

    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    maximizeCanvas();
    window.addEventListener('resize', maximizeCanvas);

    gl = canvas.getContext('webgl2');
    if (gl === null) {
        alert('Unable to initialize opengl');
    }
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const vertShader = initShader('test_vert', vertSrc, gl.VERTEX_SHADER);
    const fragShader = initShader('test_frag', fragSrc, gl.FRAGMENT_SHADER);
    const program = initProgram(vertShader, fragShader);
    
    const vertices = Float32Array.from([
        -0.5, -0.5, 0.0,
        0.5, -0.5, 0.0,
        0.0, 0.5, 0.0
    ]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(0);

    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
};
