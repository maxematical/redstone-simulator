import { vec3, mat4, ReadonlyVec3 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel, Model, models } from './models';
import { BlockRenderer, MaterialRenderer, ModelCombiner, GLRenderInfo, useUvs } from './render';
import { initShader, initProgram } from './shader';
import { materialRegistry } from './materials';
import { Simulator, BlockUpdate } from './simulator';
import directions from './directions';
import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';

declare var gl: WebGL2RenderingContext;

const { abs } = Math;

/** Defines a type of block. There is one instance of these per TYPE of block (not per block). */
export interface Block {
    id: number;
    renderer: BlockRenderer;
    attractsWires?: boolean;
    /**
     * If true, power can travel through wires up onto this block, but not down from this block.
     * Visible in slabs and glowstone.
     */
    preventDownwardsTransmission?: boolean;
    isTransparent?: boolean;
    /**
     * Called when this block is placed, destroyed, or updated. The block should call
     * Simulator.queueNeighborUpdate() to update its neighbors. For most blocks, this is not a complex method
     * and an implementation generated with genUpdateNeighbors().
     */
    updateNeighbors(grid: Grid, coords: vec3, state: number, simulator: Simulator);
    handleNeighborUpdate(grid: Grid, coords: vec3, state: number, simulator: Simulator);
}

const genUpdateNeighbors = (range: ReadonlyVec3[]) => (grid: Grid, coords: vec3, state: number, simulator: Simulator) => {
    simulator.queueBlockUpdate().set(coords, range);
};

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
const WIRE_TEXTURE_LINE_2 = 7; // Unrotated is from -Z to +Z
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

        // Count connections
        let nConnections = 0;
        for (let bit = 4; bit <= 7; bit++)
            if (state & (1 << bit))
                nConnections++;

        // Handy variables
        const w = !!(state & 0x80);
        const e = !!(state & 0x40);
        const n = !!(state & 0x20);
        const s = !!(state & 0x10);

        // Determine the shape and orientation of our texture
        if (nConnections === 0) {
            // 0 connections: Plus or dot
            const isDot = (state & 0x1000) === 1;
            wireTexture = isDot ? WIRE_TEXTURE_DOT : WIRE_TEXTURE_PLUS;
        } else if (nConnections === 1) {
            // 1 connection: Line
            wireTexture = (e || w) ? WIRE_TEXTURE_LINE : WIRE_TEXTURE_LINE_2;
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
                else if (n && e) wireRotation = 270; // case for rotation=0 handled by default
            }
        } else if (nConnections === 3) {
            // 3 connections: T shape
            wireTexture = WIRE_TEXTURE_3WAY;
            if (!e) wireRotation = 90;
            else if (!n) wireRotation = 180;
            else if (!w) wireRotation = 270; // case for rotation=0 handled by default
        } else {
            // 4 connections: Plus
            wireTexture = WIRE_TEXTURE_PLUS;
        }

        // Determine whether to render wires on the sides of adjacent blocks
        const verticalWireW = !!(state & 0x800);
        const verticalWireE = !!(state & 0x400);
        const verticalWireN = !!(state & 0x200);
        const verticalWireS = !!(state & 0x100);

        // Do normal render stuff
        const translateUp = 0.05;
        const mat = mat4.create();
        mat4.translate(mat, mat, coords);
        mat4.translate(mat, mat, [0.005, translateUp, 0.005]);
        mat4.scale(mat, mat, [0.99, 1 - translateUp, 0.99]);
        
        const extraData = [];
        for (let i = 0; i < 6; i++) {
            let faceTexture = 64;
            if (i === 5) faceTexture = wireTexture;
            else if (i === 1 && verticalWireW) faceTexture = WIRE_TEXTURE_LINE_2;
            else if (i === 2 && verticalWireE) faceTexture = WIRE_TEXTURE_LINE_2;
            else if (i === 3 && verticalWireN) faceTexture = WIRE_TEXTURE_LINE_2;
            else if (i === 4 && verticalWireS) faceTexture = WIRE_TEXTURE_LINE_2;
            const faceRotation = (i === 5) ? wireRotation : 0;
            useUvs(faceTexture, extraData, i * 8, faceRotation);
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

const torchRenderer: BlockRenderer = {
    materialName: 'default',
    nModels: 1,
    render: (grid, coords, block, state, out) => {
        const mat = mat4.create();
        mat4.translate(mat, mat, coords);
        
        const uvs = [];
        for (let i = 0; i < 6; i++) {
            let faceTexture = 8; // Side texture
            if (i === 0) faceTexture = 9; // Top texture
            else if (i === 5) faceTexture = 10; // Bottom texture
            useUvs(faceTexture, uvs, i*8);
        }

        const model = Model.use(models.torch, { nPerVertex: 2, data: uvs }, mat);
        ModelCombiner.addModel(out, model);
    }
};

const ONE_BLOCK_TAXICAB: ReadonlyVec3[] = [];
const TWO_BLOCKS_TAXICAB: ReadonlyVec3[] = [];
for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
        for (let z = -2; z <= 2; z++) {
            const taxicabDist = abs(x) + abs(y) + abs(z);
            if (taxicabDist === 0) continue;
            const vec = vec3.fromValues(x, y, z);
            if (taxicabDist <= 1) ONE_BLOCK_TAXICAB.push(vec);
            if (taxicabDist <= 2) TWO_BLOCKS_TAXICAB.push(vec);
        }
    }
}

const blockRegistry: Block[] = [];

const stone: Block = {
    id: ++blockIdCounter,
    renderer: solidBlockRenderer,
    updateNeighbors: genUpdateNeighbors(ONE_BLOCK_TAXICAB),
    handleNeighborUpdate: () => {}
}; blockRegistry[blockIdCounter] = stone;

// Redstone dust state:
// Redstone dust has 2 different parts to its state:
// 1) Signal strength, 0-15. This is stored in the 4 least significant bits, mask 0xF.
// 2) Connected ness. Wire can be connected in a line, T, cross, or none. When disconnected
// can be set to either a cross shape or a dot shape. This is stored in the next 5 significant
// bits, mask 0x1FF0. (Counting from MSB to LSB:) First bit is cross(0) or dot(1), relevant only
// when disconnected (ie. other bits mask 0xF0 are 0). The next 4 bits (mask 0xF00) are whether
// the wire is travelling up a block to the west(-X), east(+X), north(-Z), or south(+Z), respectively.
// The other 4 bits (mask 0xF0) are whether the wire is connected to the west, east, north, south
// respectively.
const DUST_Y_ORDER = [0, -1, 1];
const dust: Block = {
    id: ++blockIdCounter,
    renderer: redstoneDustRenderer,
    attractsWires: true,
    isTransparent: true,
    updateNeighbors: (grid: Grid, coords: vec3, state: number, simulator: Simulator) => {
        // Send updates within a 2-block taxicab distance, but also send updates to the blocks
        // above and below any non-wire blocks that the dust is pointing to
        simulator.queueBlockUpdate().set(coords, TWO_BLOCKS_TAXICAB);

        // Search in each direction, if we are facing into a block there and it's not a wire
        // block, then send an update that way
        // TODO Test if this works!
        let alsoUpdate: vec3[] = null;
        let out: [Block, number] = null;
        for (let dir = 0; dir < 4; dir++) {
            const dirBit = 7 - dir;
            const dirVec = directions.wens[dir];
            const isFacingDirection = !!(state & (1 << dirBit));
            if (isFacingDirection) {
                // Check if we're facing a block here and that block is not redstone dust
                const vec = vec3.create();
                vec3.add(vec, coords, dirVec);
                out = out || [null, 0];
                Grid.getN(grid, vec, out);
                if (!out[0] || out[0] == blocks.dust) continue;

                // Update up neighbor
                alsoUpdate = alsoUpdate || [];
                vec3.add(vec, vec, directions.up);
                alsoUpdate.push(vec3.clone(vec));

                // Update down neighbor
                vec3.add(vec, vec, directions.down);
                vec3.add(vec, vec, directions.down);
                alsoUpdate.push(vec);
            }
        }
        if (alsoUpdate)
            simulator.queueBlockUpdate().set(coords, alsoUpdate);
    },
    handleNeighborUpdate: (grid: Grid, coords: vec3, oldState: number, simulator: Simulator) => {
        const out: [Block, number] = [null, 0]; // used later for getting blocks

        // Check connectedness
        let newState = oldState & 0xF;
        let anyConnection = false;

        // Search for possible connections and set bits corresponding to the direction of
        // that neighbor. First search the same level, then the next level
        const temp = vec3.create();
        for (let iy = 0; iy < DUST_Y_ORDER.length; iy++) {
            const y = DUST_Y_ORDER[iy];
            for (let i = 0; i < directions.wens.length; i++) {
                // Calculate offset coordinate
                const dir = directions.wens[i];
                vec3.add(temp, coords, dir);
                if (y === -1) vec3.add(temp, temp, directions.down);
                if (y === 1) vec3.add(temp, temp, directions.up);

                // If there is a block that attracts wires here, set the bit for this direction
                // Otherwise, the bit is already unset, so we don't need to do anything
                if (!Grid.inBounds(grid, temp)) continue;
                Grid.getN(grid, temp, out);
                if (!out[0] || !out[0].attractsWires) continue;

                // "Pinching" - wires can't connect up/down if there's a block "pinching" the connection
                // like so:
                // rB
                // Br   B=Solid block   R=redstone
                // Also handle the "slab rule" I.e. no downwards transmission of power from slabs
                if (y === 1) {
                    // When going up: wire is pinched if there's a block above it
                    vec3.add(temp, coords, directions.up);
                    const pinchBlock = Grid.getBlockN(grid, temp);
                    if (pinchBlock && !pinchBlock.isTransparent)
                        continue;
                } else if (y === -1) {
                    // When going down: wire is pinched if there's a block on the adjacent side
                    vec3.add(temp, coords, dir);
                    const pinchBlock = Grid.getBlockN(grid, temp);
                    if (pinchBlock && !pinchBlock.isTransparent)
                        continue;
                    
                    // Some blocks (e.g. slabs) prevent power from travelling donwards
                    // TODO This is important!!!
                    // If going up to a wire that is on a slab, we need to VISUALLY not show
                    // the vertical line but still allow power to travel up
                    vec3.add(temp, coords, directions.down);
                    const onBlock = Grid.getBlockN(grid, temp);
                    if (onBlock.preventDownwardsTransmission&&0)
                        continue;
                }

                // The wire can connect here, set the corresponding bit
                const bit = 7 - i;
                newState |= (1 << bit);
                anyConnection = true;

                // If y is 1, also set the "up-one bit"
                // But not if the connecting wire is on a slab
                if (y === 1) {
                    vec3.add(temp, coords, dir);
                    const onBlock = Grid.getBlockN(grid, temp);
                    if (!onBlock.preventDownwardsTransmission)
                        newState |= (1 << (11 - i));
                }
            }
        }

        // If there is a connection, plus/dot bit should be zero, otherwise keep it the same as before
        const plusDotValue = anyConnection ? 0 : oldState & 0x1000;
        newState |= plusDotValue << 8;

        // Set the new state
        if (newState !== oldState) {
            Grid.set(grid, coords, dust, newState);

            // If the state changed, update neighbors
            // TODO Also Send Block update when dust is destroyed
            simulator.queueBlockUpdate().set(temp, TWO_BLOCKS_TAXICAB);
        }
    }
}; blockRegistry[blockIdCounter] = dust;
const slab: Block = {
    id: ++blockIdCounter,
    renderer: slabRenderer,
    preventDownwardsTransmission: true,
    isTransparent: true,
    updateNeighbors: genUpdateNeighbors(ONE_BLOCK_TAXICAB),
    handleNeighborUpdate: () => {}
}; blockRegistry[blockIdCounter] = slab;
const torch: Block = {
    id: ++blockIdCounter,
    renderer: torchRenderer,
    isTransparent: true,
    attractsWires: true,
    updateNeighbors: genUpdateNeighbors(TWO_BLOCKS_TAXICAB),
    handleNeighborUpdate: () => {}
}; blockRegistry[blockIdCounter] = torch;

export const blocks = {
    stone,
    dust,
    slab,
    torch,

    blockRegistry,
    byId: (id: number, allowNull?: boolean): Block => {
        const block = blocks.blockRegistry[id];
        if (!block && !allowNull) {
            throw new Error(`Tried to find a block with an invalid ID: ${id}`);
        }
        return block || null;
    }
};
