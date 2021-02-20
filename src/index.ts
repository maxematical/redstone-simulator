import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';
import { Grid } from './grid';
import { Model, models } from './models';
import { vec3, mat4 } from 'gl-matrix';

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

    const vertShader = initShader('test_vert', vertSrc, gl.VERTEX_SHADER);
    const fragShader = initShader('test_frag', fragSrc, gl.FRAGMENT_SHADER);
    const program = initProgram(vertShader, fragShader);
    const loc_mvp = gl.getUniformLocation(program, 'mvp');

    let modelRotation = 0.0;
    const modelMat = mat4.create();
    const projMat = mat4.create();
    mat4.perspective(projMat, 1.2217, canvas.width/canvas.height, 0.1, 100);
    const cameraMat = mat4.create();
    mat4.translate(cameraMat, cameraMat, [0, 0, -3]);
    const mvpMat = mat4.create();
    
    //const model = Model.use(models.fullBlock, { nPerVertex: 1, data: [0, 1, 2, 3, 4, 5, 6, 7] });
    const model = Model.use(models.triangle);
    const vertexData = model.vertexData;
    const indices = model.indices;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(0);

    let lastTimestamp: DOMHighResTimeStamp | null = null;
    const loop = (timestamp: DOMHighResTimeStamp) => {
        requestAnimationFrame(loop);

        const delta = lastTimestamp ? (timestamp - lastTimestamp) * 0.001 : 0.01;
        lastTimestamp = timestamp;

        modelRotation += 180.0 * delta;
        mat4.fromYRotation(modelMat, modelRotation * 3.14159 / 180.0);
        mat4.identity(mvpMat);
        mat4.mul(mvpMat, cameraMat, modelMat);
        mat4.mul(mvpMat, projMat, mvpMat);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniformMatrix4fv(loc_mvp, false, Float32Array.from(mvpMat));
        gl.bindVertexArray(vao);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    };
    loop(performance.now());
};
