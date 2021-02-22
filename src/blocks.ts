import { vec3, mat4 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel, Model, models } from './models';
import { BlockRenderer, MaterialRenderer, ModelCombiner, GLRenderInfo, useUvs } from './render';
import { initShader, initProgram } from './shader';
import { materialRegistry } from './materials';
import directions from './directions';
import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';

declare var gl: WebGL2RenderingContext;

/** Defines a type of block. There is one instance of these per TYPE of block (not per block). */
export interface Block {
    id: number;
    renderer: BlockRenderer;
    attractsWires?: true;
    handleNeighborUpdate(grid: Grid, coords: vec3, state: number);
}

let blockIdCounter = 0;
let renderIdCounter = 0;

class DefaultMaterialRenderer implements MaterialRenderer {
    vao: WebGLVertexArrayObject;
    vbo: WebGLBuffer;
    ebo: WebGLBuffer;
    program: WebGLProgram;
    loc_mvp: WebGLUniformLocation;
    loc_alpha: WebGLUniformLocation;
    nElements: number;

    materialName: 'default';

    constructor() {
    }

    init() {
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        const vert = initShader('test_vert', vertSrc, gl.VERTEX_SHADER);
        const frag = initShader('test_frag', fragSrc, gl.FRAGMENT_SHADER);
        this.program = initProgram(vert, frag);
        this.loc_mvp = gl.getUniformLocation(this.program, 'mvp');
        this.loc_alpha = gl.getUniformLocation(this.program, 'alpha');

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
    }

    uploadCombinedModel(model: GLModel) {
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertexData, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);
        this.nElements = model.indices.length;
    }

    renderCombinedModel(info: GLRenderInfo) {
        const alpha = info.alpha;

        gl.bindVertexArray(this.vao);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.loc_mvp, false, info.mvp);
        gl.uniform1f(this.loc_alpha, alpha);
        gl.drawElements(gl.TRIANGLES, this.nElements, gl.UNSIGNED_INT, 0);
    }
}
materialRegistry.add('default', () => new DefaultMaterialRenderer());

const solidBlockRenderer: BlockRenderer = {
    materialName: 'default',
    nModels: 1,
    render: (grid, coords, block, state, out) => {
        const mat = mat4.create();
        mat4.translate(mat, mat, coords);

        const extraData = [];
        for (let i = 0; i < 6; i++) {
            useUvs(0, extraData, i * 8);
        }

        const model = Model.use(models.texturedCube, { nPerVertex: 2, data: extraData },
            mat);
        ModelCombiner.addModel(out, model);
    }
};

const WIRE_TEXTURE_PLUS = 2;
const WIRE_TEXTURE_LINE = 3; // Unrotated is from -X to +X
const WIRE_TEXTURE_CORNER = 4; // Unrotated is from -X to -Z
const WIRE_TEXTURE_3WAY = 5; // Unrotated is from -X, -Z, and +X
const WIRE_TEXTURE_DOT = 6;

const redstoneDustRenderer: BlockRenderer = {
    materialName: 'default',
    nModels: 1,
    render: (grid, coords, block, state, out) => {
        // Figure out which texture to use for the dust
        let wireTexture: number;
        let wireRotation: number; // in degrees

        let nConnections = 0;
        for (let bit = 4; bit <= 7; bit++)
            if (state & (1 << bit))
                nConnections++;

        const w = !!(state & 0x80);
        const e = !!(state & 0x40);
        const n = !!(state & 0x20);
        const s = !!(state & 0x10);
        if (nConnections === 0) {
            // 0 connections: Plus or dot
            const isDot = (state & 0x100) === 1;
            wireTexture = isDot ? WIRE_TEXTURE_DOT : WIRE_TEXTURE_PLUS;
        } else if (nConnections === 1) {
            // 1 connection: Line
            wireTexture = WIRE_TEXTURE_LINE;
            wireRotation = (n || s) ? 90 : 0;
        } else if (nConnections === 2) {
            // 2 connections: Line or corner
            if (w && e) {
                wireTexture = WIRE_TEXTURE_LINE;
            } else if (n && s) {
                wireTexture = WIRE_TEXTURE_LINE; wireRotation = 90;
            } else {
                wireTexture = WIRE_TEXTURE_CORNER;
                // 4 possible ways the corner can go
                if (s && w) wireRotation = 90;
                else if (s && e) wireRotation = 180;
                else if (n && e) wireRotation = 270; // last case handled by default
            }
        } else if (nConnections === 3) {
            // 3 connections: T shape
            wireTexture = WIRE_TEXTURE_3WAY;
            if (!e) wireRotation = 90;
            else if (!n) wireRotation = 180;
            else if (!w) wireRotation = 270; // last case handled by default
        } else {
            // 4 connections: Plus
            wireTexture = WIRE_TEXTURE_PLUS;
        }

        // Do normal render stuff
        const translateUp = 0.05;
        const mat = mat4.create();
        mat4.translate(mat, mat, coords);
        if (wireRotation) {
            mat4.translate(mat, mat, [0.5, 0.5, 0.5]);
            mat4.rotateY(mat, mat, wireRotation * 0.0174532925);
            mat4.translate(mat, mat, [-0.5, -0.5, -0.5]);
        }
        mat4.translate(mat, mat, [0, translateUp, 0]);
        mat4.scale(mat, mat, [1, 1 - translateUp, 1]);
        
        const extraData = [];
        for (let i = 0; i < 6; i++) {
            const sideTexture = (i === 5) ? wireTexture : 64;
            useUvs(sideTexture, extraData, i * 8);
        }

        const model = Model.use(models.texturedCube, { nPerVertex: 2, data: extraData }, mat, true);
        ModelCombiner.addModel(out, model);
    },
};

const slabRenderer: BlockRenderer = {
    materialName: 'default',
    nModels: 1,
    render: (grid, coords, block, state, out) => {
        const mat = mat4.create();
        mat4.translate(mat, mat, coords);
        mat4.translate(mat, mat, [0, 0.5, 0]);
        mat4.scale(mat, mat, [1, 0.5, 1]);

        const extraData = [];
        for (let i = 0; i < 6; i++) useUvs(0, extraData, i * 8);

        const model = Model.use(models.texturedCube, { nPerVertex: 2, data: extraData }, mat);
        ModelCombiner.addModel(out, model);
    }
};

const blockRegistry: Block[] = [];

const stone: Block = {
    id: ++blockIdCounter,
    renderer: solidBlockRenderer,
    handleNeighborUpdate: () => {}
}; blockRegistry[blockIdCounter] = stone;

// Redstone dust state:
// Redstone dust has 2 different parts to its state:
// 1) Signal strength, 0-15. This is stored in the 4 least significant bits, mask 0xF.
// 2) Connected ness. Wire can be connected in a line, T, cross, or none. When disconnected
// can be set to either a cross shape or a dot shape. This is stored in the next 5 significant
// bits, mask 0x1F0. (Counting from MSB to LSB:) First bit is cross(0) or dot(1), relevant only
// when disconnected (ie. other bits mask 0xF0 are 0). The next 4 bits are whether the wire is
// connected to the west(-X), east(+X), north(-Z), or south(+Z), respectively.
const dust: Block = {
    id: ++blockIdCounter,
    renderer: redstoneDustRenderer,
    attractsWires: true,
    handleNeighborUpdate: (grid: Grid, coords: vec3, oldState: number) => {
        const out: [Block, number] = [null, 0]; // used later for getting blocks

        // Check connectedness
        let newState = oldState & 0xF;
        let anyConnection = false;

        // Search same level
        const temp = vec3.create();
        for (let i = 0; i < directions.wens.length; i++) {
            const dir = directions.wens[i];
            
            // If there is a block that attracts wires here, set the bit for this direction
            // Otherwise, the bit is already unset, so we don't need to do anything
            vec3.add(temp, coords, dir);
            if (!Grid.inBounds(grid, temp)) continue;
            Grid.getN(grid, temp, out);
            if (!out[0] || !out[0].attractsWires) continue;

            // There is a block here and it attracts wires, set the corresponding bit
            const bit = 7 - i;
            newState |= (1 << bit);
            anyConnection = true;
        }

        // TODO: Search up/down levels

        // If there is a connection, plus/dot bit should be zero, otherwise keep it the same as before
        const plusDotValue = anyConnection ? 0 : oldState & 0x100;
        newState |= plusDotValue << 8;

        // Set the new state
        Grid.set(grid, coords, dust, newState);
        console.log('NewState', coords, newState.toString(2));
    }
}; blockRegistry[blockIdCounter] = dust;
const slab: Block = {
    id: ++blockIdCounter,
    renderer: slabRenderer,
    handleNeighborUpdate: () => {}
}; blockRegistry[blockIdCounter] = slab;

export const blocks = {
    stone,
    dust,
    slab,

    blockRegistry,
    byId: (id: number, allowNull?: boolean): Block => {
        const block = blocks.blockRegistry[id];
        if (!block && !allowNull) {
            throw new Error(`Tried to find a block with an invalid ID: ${id}`);
        }
        return block || null;
    }
};
