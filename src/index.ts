import { GLRenderInfo, LayeredGridRenderer } from './render';
import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';
import { Grid } from './grid';
import { Model, models } from './models';
import { vec3, mat4 } from 'gl-matrix';
import { Block, Blocks } from './blocks';
import cursor from './cursor';
import input from './input';
import imgSrc from './redstone.png';

var canvas: HTMLCanvasElement = null;
var gl: WebGL2RenderingContext = null;
var grid: Grid = Grid.new([1, 1, 1]);

const { cos, sin, min, round } = Math;

const lerp = (a: number, b: number, t: number) => a * (1.0 - t) + b * t;

const maximizeCanvas = () => {
    const body = document.querySelector('body');
    canvas.width = body.offsetWidth;
    canvas.height = body.offsetHeight;
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

    const texture = gl.createTexture();

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
    const temp = vec3.create();
    const CAMERA_SHIFT: vec3 = [ 0, 0, 7.5 ];
    
    const ANIMATION_LENGTH = 75;
    const animationStartPos: vec3 = vec3.create();
    let camRotationXStart = 0.0;
    let camRotationYStart = 0.0;
    let animationStartTime: DOMHighResTimeStamp = 0;
    const highlightBlockAnimated = vec3.create();

    const CAM_ROTATE_X_1 = 0.00;
    const CAM_ROTATE_X_2 = 0.15;
    const CAM_ROTATE_Y = -0.025;
    let camRotationX = CAM_ROTATE_X_2;
    let camRotationY = CAM_ROTATE_Y;
    let camRotationXAnimated = camRotationX;
    let camRotationYAnimated = camRotationY;
    let camYaw = 0.0;
    let camYawAnimated = 0.0;
    let camYawAnimateStart = 0.0;

    const oldHighlightBlock = vec3.create();

    const VEC3_HALF: vec3 = [0.5, 0.5, 0.5];

    let selectedBlockId = 1;

    cursor.init();

    let totalTime: DOMHighResTimeStamp = 0;
    let lastTimestamp: DOMHighResTimeStamp | null = null;
    const renderInfo: GLRenderInfo = { mvp: mvpMat, time: totalTime };
    const loop = (timestamp: DOMHighResTimeStamp) => {
        requestAnimationFrame(loop);

        const delta = lastTimestamp ? (timestamp - lastTimestamp) * 0.001 : 0.01;
        lastTimestamp = timestamp;
        totalTime += delta;

        input.update();

        vec3.copy(oldHighlightBlock, highlightBlock);
        if (input.keyDown['KeyA']) {
            highlightBlock[0] -= cos(camYaw);
            highlightBlock[2] -= sin(camYaw);
            camRotationY = -CAM_ROTATE_Y;
        }
        if (input.keyDown['KeyD']) {
            highlightBlock[0] += cos(camYaw);
            highlightBlock[2] += sin(camYaw);
            camRotationY = CAM_ROTATE_Y;
        }
        if (input.keyDown['KeyS']) {
            highlightBlock[1]--;
            camRotationX = CAM_ROTATE_X_1;
        }
        if (input.keyDown['KeyW']) {
            highlightBlock[1]++;
            camRotationX = CAM_ROTATE_X_2;
        }
        if (input.keyDown['KeyQ']) {
            highlightBlock[0] += sin(camYaw);
            highlightBlock[2] -= cos(camYaw);
        }
        if (input.keyDown['KeyE']) {
            highlightBlock[0] -= sin(camYaw);
            highlightBlock[2] += cos(camYaw);
        }
        vec3.round(highlightBlock, highlightBlock);

        if (input.keyDown['KeyZ'])
            lgr.fadeLayers = !lgr.fadeLayers;

        let rotated = false;
        if (input.keyDown['ArrowLeft']) {
            camYaw += 1.57079633;
            rotated = true;
        }
        if (input.keyDown['ArrowRight']) {
            camYaw -= 1.57079633;
            rotated = true;
        }
        if (rotated)
            camRotationX = 0;

        for (let i = 1; i <= 9; i++) {
            if (input.keyDown['Digit' + i] && Blocks.blockRegistry[i]) {
                selectedBlockId = i;
            }
        }

        const moved = !vec3.equals(highlightBlock, oldHighlightBlock);

        if (moved || rotated) {
            vec3.copy(animationStartPos, highlightBlockAnimated);
            camRotationXStart = camRotationXAnimated;
            camRotationYStart = camRotationYAnimated;
            camYawAnimateStart = camYawAnimated;
            animationStartTime = timestamp;
        }

        if (animationStartPos) {
            const t = min((timestamp - animationStartTime) / ANIMATION_LENGTH, 1);
            vec3.lerp(highlightBlockAnimated, animationStartPos, highlightBlock, t);
            camRotationXAnimated = lerp(camRotationXStart, camRotationX, t);
            camRotationYAnimated = lerp(camRotationYStart, camRotationY, t);
            camYawAnimated = lerp(camYawAnimateStart, camYaw, t);
        }

        let changed = false;
        if (input.keyDown['Space']) {
            if (!Grid.inBounds(grid, highlightBlock)) {
                const newMin = vec3.create();
                const newMax = vec3.create();
                vec3.min(newMin, grid.min, highlightBlock);
                vec3.max(newMax, grid.max, highlightBlock);
                Grid.resize(grid, newMin, newMax);
            }
            const out: [Block, number] = [null, 0];
            Grid.getN(grid, highlightBlock, out);
            const nextBlock: Block = out[0] ? null : Blocks.blockRegistry[selectedBlockId];
            Grid.set(grid, highlightBlock, nextBlock);
            changed = true;
        }

        if (moved || rotated || changed) {
            lgr.setCamera([ round(sin(camYaw)), 0, round(-cos(camYaw)) ], highlightBlock);
            lgr.updateModels(grid);
        }

        vec3.negate(temp, CAMERA_SHIFT);
        mat4.fromTranslation(cameraMat, temp);
        mat4.rotateX(cameraMat, cameraMat, camRotationXAnimated);
        mat4.rotateY(cameraMat, cameraMat, camYawAnimated + camRotationYAnimated);
        vec3.negate(temp, highlightBlockAnimated);
        vec3.sub(temp, temp, VEC3_HALF);
        mat4.translate(cameraMat, cameraMat, temp);

        mat4.identity(mvpMat);
        mat4.mul(mvpMat, cameraMat, modelMat);
        mat4.mul(mvpMat, projMat, mvpMat);

        // Do rendering
        renderInfo.time = totalTime;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Draw grid
        lgr.render(renderInfo);

        // Draw cursor
        cursor.render(renderInfo, highlightBlock, Grid.getBlockN(grid, highlightBlock) ? 1.0 : 0.35);
    };
    const image = new Image();
    image.src = imgSrc;
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        loop(performance.now());
    };
};
