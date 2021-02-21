import { GLRenderInfo, LayeredGridRenderer } from './render';
import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';
import { Grid } from './grid';
import { Model, models } from './models';
import { vec3, mat4 } from 'gl-matrix';
import { Block, Blocks } from './blocks';
import input from './input';

var canvas: HTMLCanvasElement = null;
var gl: WebGL2RenderingContext = null;
var grid: Grid = Grid.new([1, 1, 1]);

const { sin, min } = Math;

const lerp = (a: number, b: number, t: number) => a * (1.0 - t) + b * t;

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
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vertShader = initShader('test_vert', vertSrc, gl.VERTEX_SHADER);
    const fragShader = initShader('test_frag', fragSrc, gl.FRAGMENT_SHADER);
    const program = initProgram(vertShader, fragShader);
    const loc_mvp = gl.getUniformLocation(program, 'mvp');

    let modelRotation = 0.0;
    const rotationAxis: vec3 = [ 0.2, 1.0, -0.2 ];
    vec3.normalize(rotationAxis, rotationAxis);
    const modelMat = mat4.create();
    const projMat = mat4.create();
    mat4.perspective(projMat, 0.9, canvas.width/canvas.height, 0.1, 100);
    // const orthoZoom = 3;
    // const aspect = canvas.height / canvas.width;
    // mat4.ortho(projMat, -orthoZoom, orthoZoom, -orthoZoom * aspect, orthoZoom * aspect, 0.1, 100);
    // mat4.rotateX(projMat, projMat, 0.1);
    // mat4.rotateY(projMat, projMat, 0.1);
    const cameraMat = mat4.create();
    const mvpMat = new Float32Array(16);
    
    const grid = Grid.new([3, 3, 3]);
    Grid.set(grid, [0, 0, 0], Blocks.stone);
    Grid.set(grid, [1, 0, 0], Blocks.stone);
    Grid.set(grid, [0, 1, 0], Blocks.stone);

    // we are definitely facing -Z
    const lgr = new LayeredGridRenderer();
    lgr.setCamera([0, 0, -1], vec3.create());
    lgr.updateModels(grid);

    const highlightBlock = vec3.create(); // whole coordinates
    const cameraTranslation = vec3.create();
    const CAMERA_SHIFT: vec3 = [ 0.5, 0.5, 7.5 ];
    
    const ANIMATION_LENGTH = 75;
    const animationStartPos: vec3 = vec3.create();
    let camRotationXStart = 0.0;
    let camRotationYStart = 0.0;
    let animationStartTime: DOMHighResTimeStamp = 0;
    const highlightBlockAnimated = vec3.create();

    const CAM_ROTATE_X = 0.05;
    const CAM_ROTATE_Y = -0.05;
    let camRotationX = CAM_ROTATE_X;
    let camRotationY = CAM_ROTATE_Y;
    let camRotationXAnimated = camRotationX;
    let camRotationYAnimated = camRotationY;

    const oldHighlightBlock = vec3.create();

    let totalTime: DOMHighResTimeStamp = 0;
    let lastTimestamp: DOMHighResTimeStamp | null = null;
    const renderInfo: GLRenderInfo = { mvp: mvpMat };
    const loop = (timestamp: DOMHighResTimeStamp) => {
        requestAnimationFrame(loop);

        const delta = lastTimestamp ? (timestamp - lastTimestamp) * 0.001 : 0.01;
        lastTimestamp = timestamp;
        totalTime += delta;

        input.update();

        vec3.copy(oldHighlightBlock, highlightBlock);
        if (input.keyDown['KeyA']) {
            highlightBlock[0]--;
            camRotationY = -CAM_ROTATE_Y;
        }
        if (input.keyDown['KeyD']) {
            highlightBlock[0]++;
            camRotationY = CAM_ROTATE_Y;
        }
        if (input.keyDown['KeyS']) {
            highlightBlock[1]--;
            camRotationX = -CAM_ROTATE_X;
        }
        if (input.keyDown['KeyW']) {
            highlightBlock[1]++;
            camRotationX = CAM_ROTATE_X;
        }
        if (input.keyDown['KeyQ'])
            highlightBlock[2]++;
        if (input.keyDown['KeyE'])
            highlightBlock[2]--;

        const moved = !vec3.equals(highlightBlock, oldHighlightBlock);
        if (moved) {
            vec3.copy(animationStartPos, highlightBlockAnimated);
            camRotationXStart = camRotationXAnimated;
            camRotationYStart = camRotationYAnimated;
            animationStartTime = timestamp;
        }

        if (animationStartPos) {
            const t = min((timestamp - animationStartTime) / ANIMATION_LENGTH, 1);
            vec3.lerp(highlightBlockAnimated, animationStartPos, highlightBlock, t);
            camRotationXAnimated = lerp(camRotationXStart, camRotationX, t);
            camRotationYAnimated = lerp(camRotationYStart, camRotationY, t);
        }

        let changed = false;
        if (input.keyDown['Space']) {
            if (Grid.inBounds(grid, highlightBlock)) {
                const out: [Block, number] = [null, 0];
                Grid.getN(grid, highlightBlock, out);
                const nextBlock: Block = out[0] ? null : Blocks.stone;
                Grid.set(grid, highlightBlock, nextBlock);
                changed = true;
            }
        }

        // modelRotation += 180.0 * delta;
        // mat4.fromRotation(modelMat, modelRotation * 3.14159 / 180.0, [0,1,0]);
        // mat4.rotateX(modelMat, modelMat, 0.1 * sin(totalTime * 2.5));
        // mat4.translate(modelMat, modelMat, [ -0.5, -0.5, -0.5 ]);

        lgr.setCamera(lgr._facingAxis, highlightBlock);
        if (moved || changed)
            lgr.updateModels(grid);

        vec3.add(cameraTranslation, highlightBlockAnimated, CAMERA_SHIFT);
        vec3.negate(cameraTranslation, cameraTranslation);
        // mat4.fromYRotation(cameraMat, camRotationY);
        // mat4.translate(cameraMat, cameraMat, cameraTranslation);
        mat4.fromTranslation(cameraMat, cameraTranslation);
        mat4.rotateY(cameraMat, cameraMat, camRotationYAnimated);
        mat4.rotateX(cameraMat, cameraMat, camRotationXAnimated);
        mat4.identity(mvpMat);
        mat4.mul(mvpMat, cameraMat, modelMat);
        mat4.mul(mvpMat, projMat, mvpMat);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //GridRenderer.render(gridRenderer, renderInfo);
        lgr.render(renderInfo);
    };
    loop(performance.now());
};
