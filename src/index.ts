import { GLRenderInfo, GridRenderer } from './render';
import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';
import { Grid } from './grid';
import { Model, models } from './models';
import { vec3, mat4 } from 'gl-matrix';
import { Blocks } from './blocks';
import input from './input';

var canvas: HTMLCanvasElement = null;
var gl: WebGL2RenderingContext = null;
var grid: Grid = Grid.new([1, 1, 1]);

const { sin } = Math;

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

    input.init();

    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    maximizeCanvas();
    window.addEventListener('resize', maximizeCanvas);

    gl = window.gl = canvas.getContext('webgl2');
    if (gl === null) {
        alert('Unable to initialize opengl');
    }
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.cullFace(gl.BACK);

    const vertShader = initShader('test_vert', vertSrc, gl.VERTEX_SHADER);
    const fragShader = initShader('test_frag', fragSrc, gl.FRAGMENT_SHADER);
    const program = initProgram(vertShader, fragShader);
    const loc_mvp = gl.getUniformLocation(program, 'mvp');

    let modelRotation = 0.0;
    const rotationAxis: vec3 = [ 0.2, 1.0, -0.2 ];
    vec3.normalize(rotationAxis, rotationAxis);
    const modelMat = mat4.create();
    const projMat = mat4.create();
    mat4.perspective(projMat, 1.2217, canvas.width/canvas.height, 0.1, 100);
    const cameraMat = mat4.create();
    mat4.translate(cameraMat, cameraMat, [0, 0, -3]);
    const mvpMat = new Float32Array(16);
    
    const grid = Grid.new([3, 3, 3]);
    Grid.set(grid, [0, 0, 0], Blocks.stone);
    Grid.set(grid, [1, 0, 0], Blocks.stone);
    Grid.set(grid, [0, 1, 0], Blocks.stone);
    
    const gridRenderer = GridRenderer.new();
    GridRenderer.update(gridRenderer, grid);

    let totalTime: DOMHighResTimeStamp = 0;
    let lastTimestamp: DOMHighResTimeStamp | null = null;
    const renderInfo: GLRenderInfo = { mvp: mvpMat };
    const loop = (timestamp: DOMHighResTimeStamp) => {
        requestAnimationFrame(loop);

        const delta = lastTimestamp ? (timestamp - lastTimestamp) * 0.001 : 0.01;
        lastTimestamp = timestamp;
        totalTime += delta;

        modelRotation += 180.0 * delta;
        mat4.fromRotation(modelMat, modelRotation * 3.14159 / 180.0, [0,1,0]);
        mat4.rotateX(modelMat, modelMat, 0.1 * sin(totalTime * 2.5));
        mat4.translate(modelMat, modelMat, [ -0.5, -0.5, -0.5 ]);
        mat4.identity(mvpMat);
        mat4.mul(mvpMat, cameraMat, modelMat);
        mat4.mul(mvpMat, projMat, mvpMat);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        GridRenderer.render(gridRenderer, renderInfo);

        input.update();

        if (input.keyDown['KeyW'])
            console.log('w');
        if (input.keyPressed['KeyS'])
        console.log('s');
    };
    loop(performance.now());
};
