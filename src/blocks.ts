import { vec3 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel, Model, models } from './models';
import { BlockRenderer, BlockGLRenderer, ModelCombiner, GLRenderInfo } from './render';
import { initShader, initProgram } from './shader';
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

class SolidBlockGLRenderer implements BlockGLRenderer {
    vao: WebGLVertexArrayObject;
    vbo: WebGLBuffer;
    ebo: WebGLBuffer;
    program: WebGLProgram;
    loc_mvp: WebGLUniformLocation;
    nElements: number;

    constructor() {
    }

    init() {
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        const vert = initShader('test_vert', vertSrc, gl.VERTEX_SHADER);
        const frag = initShader('test_frag', fragSrc, gl.VERTEX_SHADER);
        this.program = initProgram(vert, frag);
        this.loc_mvp = gl.getUniformLocation(this.program, 'mvp');

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
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
        gl.bindVertexArray(this.vao);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.loc_mvp, false, info.mvp);
        gl.drawElements(gl.TRIANGLES, this.nElements, gl.UNSIGNED_INT, 0);
    }
}

const solidBlockRenderer: BlockRenderer = {
    id: ++renderIdCounter,
    nModels: 1,
    render: (grid, coords, block, state, out) => {
        const model = Model.use(models.fullBlock, { nPerVertex: 1, data: [ 0, 1, 2, 3, 4, 5, 6, 7 ] });
        ModelCombiner.addModel(out, model);
    },
    createBlockGLRenderer: () => new SolidBlockGLRenderer()
};

const blockRegistry: Block[] = [];

const stone: Block = {
    id: ++blockIdCounter,
    renderer: solidBlockRenderer
};
blockRegistry[blockIdCounter] = stone;

export const Blocks = {
    stone,

    blockRegistry,
    byId: (id: number) => {
        const block = Blocks.blockRegistry[id];
        if (!block) {
            throw new Error(`Tried to find a block with an invalid ID: ${id}`);
        }
        return block;
    }
};
