import './index.css';
import { GLRenderInfo, LayeredGridRenderer, HotbarRenderer } from './render';
import { Grid } from './grid';
import { Model, models } from './models';
import { vec3, mat4, ReadonlyVec3 } from 'gl-matrix';
import { Block, blocks } from './blocks';
import directions from './directions';
import cursor from './cursor';
import input from './input';
import imgSrc from './redstone.png';
import { Simulator, BlockUpdate } from './simulator';

import testVertSrc from './test_vert.glsl';
import testFragSrc from './test_frag.glsl';
import dustVertSrc from './dust_vert.glsl';
import dustFragSrc from './dust_frag.glsl';
import cursorVertSrc from './cursor_vert.glsl';
import cursorFragSrc from './cursor_frag.glsl';

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

    gl = window['gl'] = canvas.getContext('webgl2');
    if (gl === null) {
        alert('Unable to initialize opengl');
    }

    window.testVertSrc = testVertSrc;
    window.testFragSrc = testFragSrc;
    window.dustVertSrc = dustVertSrc;
    window.dustFragSrc = dustFragSrc;
    window.cursorVertSrc = cursorVertSrc;
    window.cursorFragSrc = cursorFragSrc;

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
    
    const grid = Grid.new([4, 4, 3], [0, -1, 0]);
    const simulator = new Simulator(grid);

    // Grid.set(grid, [0, 0, 0], blocks.stone);
    // Grid.set(grid, [1, 0, 0], blocks.stone);
    // Grid.set(grid, [0, 1, 0], blocks.stone);
    Grid.set(grid, [0, 0, 0], blocks.dust);
    Grid.set(grid, [1, 0, 0], blocks.stone);
    Grid.set(grid, [2, 0, 0], blocks.torch, 0x1);
    Grid.set(grid, [3, 0, 0], blocks.dust);
    Grid.set(grid, [0, 1, 0], blocks.torch, 0x2 | 0x8);
    Grid.set(grid, [1, 1, 0], blocks.stone);
    Grid.set(grid, [2, 1, 0], blocks.stone);
    Grid.set(grid, [0, -1, 0], blocks.stone);
    Grid.set(grid, [3, -1, 0], blocks.stone);
    for (let i = 0; i < 4; i++) simulator.doGameTick();
    Grid.set(grid, [1, 2, 0], blocks.dust);
    Grid.set(grid, [2, 2, 0], blocks.dust);
    for (let i = 0; i < 2; i++) simulator.doGameTick();

    const lgr = new LayeredGridRenderer();
    lgr.setCamera([0, 0, -1], vec3.create());
    lgr.updateModels(grid);

    const temp = vec3.create();
    const CAMERA_SHIFT: vec3 = [ 0, 0, 7.5 ];
    const CAM_ROTATE_X_1 = 0.15;
    const CAM_ROTATE_X_2 = 0.15;
    const CAM_ROTATE_Y = -0.025*0;

    const ANIMATION_LENGTH = 75;
    let animationStartTime: DOMHighResTimeStamp = 0;

    const highlightBlock = vec3.create(); // whole coordinates
    const highlightBlockStart: vec3 = vec3.create();
    const highlightBlockAnimated = vec3.create();
    let camTiltX = CAM_ROTATE_X_2;
    let camTiltXStart = 0.0;
    let camTiltXAnimated = camTiltX;
    let camTiltY = CAM_ROTATE_Y;
    let camTiltYStart = 0.0;
    let camTiltYAnimated = camTiltY;
    let camYaw = 0.0;
    let camYawStart = 0.0;
    let camYawAnimated = 0.0;

    const VEC3_HALF: vec3 = [0.5, 0.5, 0.5];

    let selectedBlock = blocks.stone;
    let previousSelectedBlock: Block | null = null;
    let selectedBlockTime = -100.0; // time when the current block was selected
    let selectFaceMode = false;

    cursor.init();

    let redstoneTorchCounter = 0; //TODO Remove this ASAP

    let totalTime: DOMHighResTimeStamp = 0;
    let lastTimestamp: DOMHighResTimeStamp | null = null;
    const renderInfo: GLRenderInfo = { mvp: mvpMat, time: totalTime };
    
    const hotbarRenderer = new HotbarRenderer(blocks.blockRegistry.slice(1));

    const placeBlock = (mountingDirection: ReadonlyVec3 | null) => {
        // Resize the grid to fit the cursor position, if necessary
        if (!Grid.inBounds(grid, highlightBlock)) {
            const newMin = vec3.create();
            const newMax = vec3.create();
            vec3.min(newMin, grid.min, highlightBlock);
            vec3.max(newMax, grid.max, highlightBlock);
            Grid.resize(grid, newMin, newMax);
        }

        // Place the block
        Grid.set(grid, highlightBlock, selectedBlock, selectedBlock.getPlacedState(mountingDirection));
    };
    const checkValidMountPoint = (dir: ReadonlyVec3) => {
        vec3.add(temp, highlightBlock, dir);
        const adjacentBlock = Grid.getBlockN(grid, temp);
        vec3.negate(temp, dir);
        return adjacentBlock !== null && adjacentBlock.solidFaces.query(temp);
    };

    const movementInput = vec3.create();
    const processInput = (timestamp: DOMHighResTimeStamp) => {
        input.update();

        const keyA = input.keyDown['KeyA'];
        const keyD = input.keyDown['KeyD'];
        const keyS = input.keyDown['KeyS'];
        const keyW = input.keyDown['KeyW'];
        const keyQ = input.keyDown['KeyQ'];
        const keyE = input.keyDown['KeyE'];
        const keyShift = input.keyPressed['ShiftLeft'];

        movementInput[0] = 0;
        movementInput[1] = 0;
        movementInput[2] = 0;
        if (keyA && !keyShift) {
            movementInput[0] = -cos(camYaw);
            movementInput[2] = -sin(camYaw);
            camTiltY = -CAM_ROTATE_Y;
        }
        if (keyD && !keyShift) {
            movementInput[0] = cos(camYaw);
            movementInput[2] = sin(camYaw);
            camTiltY = CAM_ROTATE_Y;
        }
        if (keyS && !keyShift) {
            movementInput[1]--;
            camTiltX = CAM_ROTATE_X_1;
        }
        if (keyW && !keyShift) {
            movementInput[1]++;
            camTiltX = CAM_ROTATE_X_2;
        }
        if (keyQ && !keyShift) {
            movementInput[0] = sin(camYaw);
            movementInput[2] = -cos(camYaw);
        }
        if (keyE && !keyShift) {
            movementInput[0] = -sin(camYaw);
            movementInput[2] = cos(camYaw);
        }
        vec3.round(movementInput, movementInput);

        if (input.keyDown['KeyZ'])
            lgr.fadeLayers = !lgr.fadeLayers;

        let rotated = false;
        if (input.keyDown['ArrowLeft'] || (keyA && keyShift)) {
            camYaw += 1.57079633;
            rotated = true;
        }
        if (input.keyDown['ArrowRight'] || (keyD && keyShift)) {
            camYaw -= 1.57079633;
            rotated = true;
        }
        if (rotated) {
            selectFaceMode = false;
        }

        for (let i = 1; i <= 9; i++) {
            if (input.keyDown['Digit' + i] && blocks.blockRegistry[i] && selectedBlock !== blocks.blockRegistry[i]) {
                // Select this block
                // Record this block as the previous one selected
                previousSelectedBlock = selectedBlock;
                // Record the time at which this block was selected
                selectedBlockTime = totalTime;
                // Update the currently selected block
                selectedBlock = blocks.blockRegistry[i];
            }
        }

        const isPlaceInput = input.keyDown['Space'];

        const hasMovementInput = !vec3.equals(movementInput, directions.none);
        let moved: boolean = false;

        // Handle input behavior -- this varies depending on the current mode
        if (!selectFaceMode) {
            // "default" mode
            moved = hasMovementInput;
            vec3.add(highlightBlock, highlightBlock, movementInput);
            cursor.showAllFaces();

            // Handle place block request
            if (isPlaceInput) {
                const currentBlock = Grid.getBlockN(grid, highlightBlock);
                let md = selectedBlock.mountingDirections?.filter(checkValidMountPoint);
                if (currentBlock !== null || !md || md.length === 1) {
                    // Can place or remove a block right away
                    if (currentBlock) Grid.set(grid, highlightBlock, null);
                    else placeBlock(md ? md[0] : null);
                } else if (md.length > 1) {
                    // Need to select a face first
                    selectFaceMode = true;
                    for (let i = 0; i < 6; i++) cursor.setShowFace(directions.weduns[i], false);
                    for (let i = 0; i < md.length; i++) cursor.setShowFace(md[i], true);
                } // If md.length===0, that means there were no valid mount points and thus can't be placed
            }
        } else {
            // select face mode -- i.e. choosing which block to place a mounted block on
            if (hasMovementInput) {
                // Trying to place a block. The mounting direction is movementInput
                const dir = movementInput;
                const isValidMountDirection = directions.arrContains(selectedBlock.mountingDirections, dir);
                const isValidMountPoint = checkValidMountPoint(dir);
                if (isValidMountDirection && isValidMountPoint) {
                    placeBlock(dir);
                    selectFaceMode = false;
                }
            }

            if (isPlaceInput)
                selectFaceMode = false;
        }

        // Handle camera animations
        if (moved || rotated) {
            vec3.copy(highlightBlockStart, highlightBlockAnimated);
            camTiltXStart = camTiltXAnimated;
            camTiltYStart = camTiltYAnimated;
            camYawStart = camYawAnimated;
            animationStartTime = timestamp;
        }
        // Update camera animations
        if (highlightBlockStart) {
            const t = min((timestamp - animationStartTime) / ANIMATION_LENGTH, 1);
            vec3.lerp(highlightBlockAnimated, highlightBlockStart, highlightBlock, t);
            camTiltXAnimated = lerp(camTiltXStart, camTiltX, t);
            camTiltYAnimated = lerp(camTiltYStart, camTiltY, t);
            camYawAnimated = lerp(camYawStart, camYaw, t);
        }

        // Update grid model
        if (moved || rotated || grid.isDirty) {
            lgr.setCamera([ round(sin(camYaw)), 0, round(-cos(camYaw)) ], highlightBlock);
            lgr.updateModels(grid);
            grid.isDirty = false;
            // TODO Right now we update EVERY model on the grid when it changes(is dirty) even
            // if its only 1 block that changed
            // In the future, track the blocks that changed so we only need to update those models
        }
    };

    let gameTickCountdown: DOMHighResTimeStamp = 0;
    const loop = (timestamp: DOMHighResTimeStamp) => {
        requestAnimationFrame(loop);

        const delta = lastTimestamp ? (timestamp - lastTimestamp) * 0.001 : 0.01;
        lastTimestamp = timestamp;
        totalTime += delta;

        processInput(timestamp);

        gameTickCountdown -= delta;
        if (gameTickCountdown <= 0) {
            simulator.doGameTick();
            gameTickCountdown = 0.05;
        }

        // Do rendering
        // Setup mvp matrices
        vec3.negate(temp, CAMERA_SHIFT);
        mat4.fromTranslation(cameraMat, temp);
        mat4.rotateX(cameraMat, cameraMat, camTiltXAnimated);
        mat4.rotateY(cameraMat, cameraMat, camYawAnimated + camTiltYAnimated);
        vec3.negate(temp, highlightBlockAnimated);
        vec3.sub(temp, temp, VEC3_HALF);
        mat4.translate(cameraMat, cameraMat, temp);

        mat4.identity(mvpMat);
        mat4.mul(mvpMat, cameraMat, modelMat);
        mat4.mul(mvpMat, projMat, mvpMat);

        renderInfo.time = totalTime;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Draw grid
        lgr.render(renderInfo);

        // Draw cursor
        cursor.render(renderInfo, highlightBlock, Grid.getBlockN(grid, highlightBlock) || selectFaceMode ? 1.0 : 0.35);

        // Draw hotbar
        hotbarRenderer.render(totalTime, delta,
            canvas.width, canvas.height,
            selectedBlock, previousSelectedBlock, selectedBlockTime);
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
