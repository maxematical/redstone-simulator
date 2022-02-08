import { initProgram, initShader } from './shader';
import { clamp, lerp, normalizeRad as normalizeRadians } from './util';
import { vec3, mat4 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel, Model, models } from './models';
import { Block, blocks } from './blocks';
import { materialRegistry } from './materials';
import tuple from './tuples';

import hotbar_vert from './hotbar_vert.glsl';
import hotbar_frag from './hotbar_frag.glsl';

declare var gl: WebGL2RenderingContext;

const { abs, min, max, floor } = Math;

export interface ModelCombiner {
    _modelBuffer: GLModel[];
    _totalVertices: number;
    _totalIndices: number;
}

export const ModelCombiner = {
    new: (): ModelCombiner => ({ _modelBuffer: [], _totalVertices: 0, _totalIndices: 0 }),

    /** Adds a model */
    addModel: (self: ModelCombiner, model: GLModel): void => {
        self._modelBuffer.push(model);
        self._totalVertices += model.vertexData.length;
        self._totalIndices += model.indices.length;
    },

    /** Combines into single model */
    combine: (self: ModelCombiner): GLModel => {
        const vertexData = new Array(self._totalVertices);
        const indices = new Array(self._totalIndices);

        let vertexDataIndex = 0;
        let indicesIndex = 0;
        let modelStartVertex = 0;

        for (let i = 0; i < self._modelBuffer.length; i++) {
            const model = self._modelBuffer[i];
            for (let j = 0; j < model.vertexData.length; j++)
                vertexData[vertexDataIndex++] = model.vertexData[j];
            for (let j = 0; j < model.indices.length; j++)
                indices[indicesIndex++] = model.indices[j] + modelStartVertex;
            modelStartVertex += model.vertexData.length / model.dataPerVertex;
        }
        return {
            vertexData: Float32Array.from(vertexData),
            indices: Uint32Array.from(indices),
            dataPerVertex: null
        };
    },

    clear: (self: ModelCombiner): void => {
        self._modelBuffer.splice(0);
        self._totalVertices = 0;
        self._totalIndices = 0;
    }
};

/**
 * A renderer for a certain type of blocks. There will be 1 of these per type of block in the
 * simulator. Its primary purpose is its render function which
 * writes models into the ModelCombiner. The particular subclass of the renderer may add additional
 * information to these models, such as UV coordinates or information for the shader.
 * 
 * The same BlockRenderer can be used by multiple block types, as long as the number of models added
 * per render invocation is the same for each type of block.
 * 
 * A reference to a BlockRenderer can be obtained through a Block object.
 */
export interface BlockRenderer {
    nModels: number;
    materialName: string;

    /** Called to render for a single block in a grid. Add models to the ModelCombiner */
    render(grid: Grid, coords: vec3, block: Block, state: number, out: ModelCombiner);
}

/**
 * Manages rendering for a specific material (Shader). There will be one of these instantiated per
 * material, per combined model. Will handle VBOs/EBOs and directly interface with OpenGL.
 * 
 * A material can be used for one or more block types. Blocks will generally use a generally use a
 * different material when they need a different shader than the default one.
 */
export interface MaterialRenderer {
    /** The name of the material we are rendering */
    materialName: string;

    init();

    /**
     * The models that sent to the render function are combined and given to this function so that they can be
     * uploaded to the GPU.
     */
    uploadCombinedModel(model: GLModel);

    /** Called to render the combined model, I.e. the final step in rendering this particular type of block. */
    renderCombinedModel(info: GLRenderInfo, alpha: number);
}

export class LayerRenderer {
    _materials: { [materialName: string]: [ModelCombiner, MaterialRenderer] };
    _materialKeys: string[];
    constructor() {
        this._materials = {};
        this._materialKeys = [];
    }
    updateModels(grid: Grid, planeNormal: vec3, planeStart: number, planeEnd?: number) {
        planeEnd = planeEnd || 50000;

        // Determine the range of coordinates to be included in this layer, considering the clipped
        // area we want this layer to render
        let minX = grid.min[0];
        let maxX = grid.max[0];
        let minY = grid.min[1];
        let maxY = grid.max[1];
        let minZ = grid.min[2];
        let maxZ = grid.max[2];
        if (planeNormal[0]) {
            const a = planeNormal[0] * planeStart;
            const b = planeNormal[0] * planeEnd;
            minX = max(minX, min(a, b));
            maxX = min(maxX, max(a, b));
        }
        if (planeNormal[1]) {
            const a = planeNormal[1] * planeStart;
            const b = planeNormal[1] * planeEnd;
            minY = max(minY, min(a, b));
            maxY = min(maxY, max(a, b));
        }
        if (planeNormal[2]) {
            const a = planeNormal[2] * planeStart;
            const b = planeNormal[2] * planeEnd;
            minZ = max(minZ, min(a, b));
            maxZ = min(maxZ, max(a, b));
        }

        // Build a GLModel for each material
        // TODO Add option to render blocks in order, from farthest-to-camera to nearest-to-camera
        // (This is needed for semitransparent rendering)
        const coords = vec3.create();
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    vec3.set(coords, x, y, z);
                    const out: [Block, number] = [null, 0];
                    Grid.getN(grid, coords, out);
                    const block = out[0];
                    const state = out[1];
                    if (!block) continue;

                    const matName = block.renderer.materialName;
                    if (!this._materials[matName]) {
                        const arr = tuple(ModelCombiner.new(), materialRegistry.createRenderer(matName));
                        arr[1].init();
                        this._materials[matName] = arr;
                        this._materialKeys.push(matName);
                    }
                    const [combiner, _] = this._materials[matName];
                    block.renderer.render(grid, coords, block, state, combiner);
                }
            }
        }

        // Upload built models to MaterialRenderers
        for (let i = 0; i < this._materialKeys.length; i++) {
            const matName = this._materialKeys[i];
            const [combiner, renderer] = this._materials[matName];
            const model = ModelCombiner.combine(combiner);
            renderer.uploadCombinedModel(model);
            ModelCombiner.clear(combiner);
        }
    }
    render(info: GLRenderInfo, alpha: number) {
        for (let i = 0; i < this._materialKeys.length; i++) {
            const matName = this._materialKeys[i];
            const [_, renderer] = this._materials[matName];
            renderer.renderCombinedModel(info, alpha);
        }
    }
}

export interface GLRenderInfo {
    mvp: Float32List;
    time: DOMHighResTimeStamp;
    //[key: string]: any; // any additional info needed for rendering
}

const ALPHA_REGRESSION = [0.2, 1.0, 0.3, 0.1]; // alpha value for each visible grid layer
export class LayeredGridRenderer {
    _layers: LayerRenderer[];
    _facingAxis: vec3;
    _centerPos: vec3;
    fadeLayers: boolean;
    constructor() {
        this._layers = new Array(4);
        this._layers[0] = new LayerRenderer();
        this._layers[1] = new LayerRenderer();
        this._layers[2] = new LayerRenderer();
        this._layers[3] = new LayerRenderer();
        this._facingAxis = vec3.create();
        this._centerPos = vec3.create();
        this.fadeLayers = true;
    }
    setCamera(facingAxis: vec3, centerPos: vec3) {
        vec3.copy(this._facingAxis, facingAxis);
        vec3.copy(this._centerPos, centerPos);
        if (this._facingAxis[0] === -0) this._facingAxis[0] = 0;
    }
    updateModels(grid: Grid) {
        const f = this._facingAxis;
        const c = this._centerPos;
        //const k = abs(f[0]) * c[0] + abs(f[1]) * c[1] + abs(f[2]) * c[2]; // the coordinate of centerPos along the facing-axis
        const k = Math.round(vec3.dot(f, c));
        this._layers[0].updateModels(grid, this._facingAxis, k + 1, k + 10000);
        this._layers[1].updateModels(grid, this._facingAxis, k);
        this._layers[2].updateModels(grid, this._facingAxis, k - 1, k - 1);
        this._layers[3].updateModels(grid, this._facingAxis, k - 2, k - 2);
    }
    render(info: GLRenderInfo) {
        for (let i = 0; i < 4; i++) {
            let alpha = this.fadeLayers ? ALPHA_REGRESSION[i] : 1.0;
            this._layers[i].render(info, alpha);
        }
    }
}

class HotbarInterfaceRenderer {
    _prog: WebGLProgram;
    _vao: WebGLVertexArrayObject;
    _loc_screenDimensions: WebGLUniformLocation;
    _loc_uiPosition: WebGLUniformLocation;
    _loc_cellParameters: WebGLUniformLocation;
    _loc_selectTime: WebGLUniformLocation;
    constructor() {
        const vert = initShader('hotbar_vert', hotbar_vert, gl.VERTEX_SHADER);
        const frag = initShader('hotbar_frag', hotbar_frag, gl.FRAGMENT_SHADER);
        this._prog = initProgram(vert, frag);
        this._loc_screenDimensions = gl.getUniformLocation(this._prog, 'screenDimensions');
        this._loc_uiPosition = gl.getUniformLocation(this._prog, 'uiPosition');
        this._loc_cellParameters = gl.getUniformLocation(this._prog, 'cellParameters');
        this._loc_selectTime = gl.getUniformLocation(this._prog, 'selectTime');

        const glModel = Model.use(models.quad);

        this._vao = gl.createVertexArray();
        const vbo = gl.createBuffer();
        const ebo = gl.createBuffer();
        gl.bindVertexArray(this._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, glModel.vertexData, gl.STATIC_DRAW)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, glModel.indices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(0);
    }
    render(screenWidth: number, screenHeight: number,
            posX: number, posY: number, width: number, height: number,
            cellSize: number, cellSpacing: number, padding: number,
            selectedIndex: number, timeSinceSelected: number) {
        gl.bindVertexArray(this._vao);
        gl.useProgram(this._prog);
        gl.uniform2f(this._loc_screenDimensions, screenWidth, screenHeight);
        gl.uniform4f(this._loc_uiPosition, posX, posY, width, height);
        gl.uniform4f(this._loc_cellParameters, cellSize, cellSpacing, padding, selectedIndex);
        gl.uniform1f(this._loc_selectTime, timeSinceSelected);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
    }
}

export class HotbarRenderer {
    _ui: HotbarInterfaceRenderer;
    _renderers: [Block, MaterialRenderer][]; // One per type of block
    _rotations: number[];
    constructor(hotbarBlocks: Block[]) {
        this._ui = new HotbarInterfaceRenderer();
        this._renderers = [];
        this._rotations = [];
        const combiner = ModelCombiner.new();
        const grid = Grid.new([1,1,1]);
        for (const block of hotbarBlocks) {
            ModelCombiner.clear(combiner);
            block.renderer.render(grid, [0,0,0], block, block.hotbarState || 0, combiner);

            const matRenderer = materialRegistry.createRenderer(block.renderer.materialName);
            matRenderer.init();
            matRenderer.uploadCombinedModel(ModelCombiner.combine(combiner));
            this._renderers.push(tuple(block, matRenderer));
            this._rotations.push(0);
        }
    }
    render(time: number, deltaTime: number,
            screenWidth: number, screenHeight: number,
            selectedBlock: Block, previousBlock: Block, selectedBlockTime: number) {
        const all_size = 50;
        const all_spacing = 25;
        const ui_padding = 5;

        const all_yOffset = clamp(0.05*screenHeight, 4, 45);
        const all_xIncrement = all_size+all_spacing;
        const all_startX = screenWidth/2 + (-this._renderers.length/2)*all_xIncrement;
        const all_startY = all_yOffset + ui_padding;


        let selectedIndex = 0;
        for (let i = 0; i < this._renderers.length; i++)
                if (selectedBlock === this._renderers[i][0])
                    selectedIndex = i;

        gl.disable(gl.DEPTH_TEST);
        this._ui.render(screenWidth, screenHeight,
            all_startX-ui_padding, all_startY-ui_padding,
            all_xIncrement*this._renderers.length + ui_padding*2 - all_spacing, all_size + ui_padding*2,
            all_size, all_spacing, ui_padding, selectedIndex, time - selectedBlockTime);
        gl.enable(gl.DEPTH_TEST);

        for (let i = 0; i < this._renderers.length; i++) {
            const mvp: mat4 = new Float32Array(16);
            const cam = mat4.create();
            const proj = mat4.create();

            const selected    = this._renderers[i][0] === selectedBlock;
            const wasSelected = this._renderers[i][0] === previousBlock;

            const selectTransition =
                selected ? this._generateTransition(time, selectedBlockTime, 8.0) :
                    (wasSelected ? 1.0 - this._generateTransition(time, selectedBlockTime, 16.0) : 0.0);
            const selectTransition2 =
                selected ? this._generateTransition(time, selectedBlockTime, 4.0) :
                    (wasSelected ? 1.0 - this._generateTransition(time, selectedBlockTime, 8.0) : 0.0);
            if (wasSelected&&!selected) console.log(selectTransition);

            const orthoSize = 1.5;
            mat4.ortho(proj, -0.5*orthoSize, 0.5*orthoSize, -0.5*orthoSize, 0.5*orthoSize, 0.1, 100.0);
            mat4.identity(cam);
            mat4.translate(cam, cam, [0, (0.125+0.05*selectTransition2)*0*Math.cos(2*Math.PI*0.5*time), -5.0]);
            mat4.rotateX(cam, cam, Math.PI*(0.08 + 0.08*selectTransition));
            const rotation: number =
                selected ? (this._rotations[i] += 2*Math.PI*0.15*deltaTime*selectTransition) :
                lerp(normalizeRadians(this._rotations[i]), 2*Math.PI*-0.05, (time-selectedBlockTime)*8);
            if (!selected)
                this._rotations[i] = rotation;
            mat4.rotateY(cam, cam, rotation);
            const scaleBlock = 1.0 + 0.2*selectTransition;
            mat4.scale(cam, cam, [scaleBlock,scaleBlock,scaleBlock]);
            mat4.translate(cam, cam, [-0.5,-0.5+0.0*selectTransition,-0.5]);
            mat4.identity(mvp);
            mat4.mul(mvp, proj, cam);

            const sizeX = all_size/screenWidth;
            const sizeY = all_size/screenHeight;
            const left = (all_startX + i*all_xIncrement)/screenWidth;
            const bottom = (all_startY)/screenHeight;
            const adjust = mat4.create();
            mat4.identity(adjust);
            mat4.translate(adjust, adjust, [-1.0 + 2*left, -1.0 + 2*bottom, 0.0]);
            mat4.scale(adjust, adjust, [sizeX,sizeY,1.0]);
            mat4.translate(adjust, adjust, [1.0, 1.0, 0.0]);
            mat4.mul(mvp, adjust, mvp);

            const renderInfo: GLRenderInfo = { mvp:mvp, time: 0.0 };
            this._renderers[i][1].renderCombinedModel(renderInfo, 1.0);
        }
    }
    _generateTransition(time: number, sinceTime: number, speed: number): number {
        return clamp((time - sinceTime) * speed, 0.0, 1.0);
    }
}

/**
 * Place the 4 UV-pairs for a quad at the specified position of an array.
 * Important: Designed for triangle vertices order:
 * (TopLeft, BottomLeft, TopRight, TopRight, BottomLeft, BottomRight).
 * Other orders may not work.
 * 
 * @param textureIndex Index in the texture map. this is an integer counting from left to right,
 * top to bottom. Top-left texture will have a textureIndex of 0, and in an 8x8 sprite atlas,
 * bottom-right will have a textureIndex of 63. This is the parameter that determines the UVs
 * put in.
 * @param out The array to place UVs in
 * @param outIndex The start index in the array to place UVs into
 * @param rotation Optional, either 0, 90, 180, or 270. Rotates the texture counter-clockwise by
 * the specified amount of degrees.
 * @param nPerVertex Optional, number of extra floats per vertex when sent to Model.use(). Defaults
 * to 2, because each vertex usually has a U and V coordinate sent along with it and nothing else.
 * This should be the same as the nPerVertex parameter sent to Model.use().
 */
export const useUvs = (textureIndex: number, out: any[], outIndex: number, rotation?: number, nPerVertex?: number): void => {
    rotation = rotation || 0;
    nPerVertex = nPerVertex || 2;
    if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270)
        throw new Error(`Rotation not a valid value: ${rotation}`);

    const k = 0.01;
    const u0 = textureIndex % 8 + k;
    const v0 = floor(textureIndex / 8) + k;
    const u1 = u0 + 1 - 2 * k;
    const v1 = v0 + 1 - 2 *k;

    const uA = u0; const vA = v0;
    const uB = u0; const vB = v1;
    const uC = u1; const vC = v0;
    const uD = u1; const vD = v1;
    const n = nPerVertex;
    if (rotation === 0) {
        out[outIndex+n*0+0] = uA; out[outIndex+n*0+1] = vA;
        out[outIndex+n*1+0] = uB; out[outIndex+n*1+1] = vB;
        out[outIndex+n*2+0] = uC; out[outIndex+n*2+1] = vC;
        out[outIndex+n*3+0] = uD; out[outIndex+n*3+1] = vD;
    } else if (rotation === 90) {
        out[outIndex+n*0+0] = uB; out[outIndex+n*0+1] = vB;
        out[outIndex+n*1+0] = uD; out[outIndex+n*1+1] = vD;
        out[outIndex+n*2+0] = uA; out[outIndex+n*2+1] = vA;
        out[outIndex+n*3+0] = uC; out[outIndex+n*3+1] = vC;
    } else if (rotation === 180) {
        out[outIndex+n*0+0] = uD; out[outIndex+n*0+1] = vD;
        out[outIndex+n*1+0] = uC; out[outIndex+n*1+1] = vC;
        out[outIndex+n*2+0] = uB; out[outIndex+n*2+1] = vB;
        out[outIndex+n*3+0] = uA; out[outIndex+n*3+1] = vA;
    } else {
        out[outIndex+n*0+0] = uC; out[outIndex+n*0+1] = vC;
        out[outIndex+n*1+0] = uA; out[outIndex+n*1+1] = vA;
        out[outIndex+n*2+0] = uD; out[outIndex+n*2+1] = vD;
        out[outIndex+n*3+0] = uB; out[outIndex+n*3+1] = vB;
    }
};
