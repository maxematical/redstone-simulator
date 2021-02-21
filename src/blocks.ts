import { vec3, mat4 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel, Model, models } from './models';
import { BlockRenderer, MaterialRenderer, ModelCombiner, GLRenderInfo, useUvs } from './render';
import { initShader, initProgram } from './shader';
import { materialRegistry } from './materials';
import vertSrc from './test_vert.glsl';
import fragSrc from './test_frag.glsl';

declare var gl: WebGL2RenderingContext;

/** Defines a type of block. There is one instance of these per TYPE of block (not per block). */
export interface Block {
    id: number;
    renderer: BlockRenderer;
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
        console.log('Added model', model);
    }
};

const redstoneDustRenderer: BlockRenderer = {
    materialName: 'default',
    nModels: 1,
    render: (grid, coords, block, state, out) => {
        const translateUp = 0.05;
        const mat = mat4.create();
        mat4.translate(mat, mat, coords);
        mat4.translate(mat, mat, [0, translateUp, 0]);
        mat4.scale(mat, mat, [1, 1 - translateUp, 1]);
        
        const extraData = [];
        for (let i = 0; i < 6; i++) {
            // Bottom face texured
            const texture = (i === 5) ? 2 : 63;
            useUvs(texture, extraData, i * 8);
        }

        const model = Model.use(models.texturedCube, { nPerVertex: 2, data: extraData }, mat, true);
        ModelCombiner.addModel(out, model);
    },
};

const blockRegistry: Block[] = [];

const stone: Block = {
    id: ++blockIdCounter,
    renderer: solidBlockRenderer
}; blockRegistry[blockIdCounter] = stone;
const dust: Block = {
    id: ++blockIdCounter,
    renderer: redstoneDustRenderer
}; blockRegistry[blockIdCounter] = dust;

export const Blocks = {
    stone,
    dust,

    blockRegistry,
    byId: (id: number, allowNull?: boolean): Block => {
        const block = Blocks.blockRegistry[id];
        if (!block && !allowNull) {
            throw new Error(`Tried to find a block with an invalid ID: ${id}`);
        }
        return block || null;
    }
};
