import { vec3 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel } from './models';
import { Block, blocks } from './blocks';
import { materialRegistry } from './materials';
import tuple from './tuples';

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
 * writes models into the ModelCombiner. These models are probably given extra vertex data by
 * the renderer such as UV coordinates or information for the shader. The same renderer can
 * be used by multiple block types, as long as the number of models added per render invocation
 * remains the same.
 */
export interface BlockRenderer {
    nModels: number;
    materialName: string;

    /** Called to render for a single block in a grid. Add models to the ModelCombiner */
    render(grid: Grid, coords: vec3, block: Block, state: number, out: ModelCombiner);
}

/**
 * Manages rendering for a material (Shader). There will be one of these instantiated per material,
 * per combined model. Will handle VBOs/EBOs and directly interface with OpenGL.
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
    renderCombinedModel(info: GLRenderInfo);
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
    render(info: GLRenderInfo) {
        for (let i = 0; i < this._materialKeys.length; i++) {
            const matName = this._materialKeys[i];
            const [_, renderer] = this._materials[matName];
            renderer.renderCombinedModel(info);
        }
    }
}

export interface GLRenderInfo {
    mvp: Float32List;
    time: DOMHighResTimeStamp;
    [key: string]: any; // any additional info needed for rendering
}

const ALPHA_REGRESSION = [0.2, 1.0, 0.3, 0.1];
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
        const info2 = { ...info, alpha: 0.0 };
        for (let i = 0; i < 4; i++) {
            let alpha = this.fadeLayers ? ALPHA_REGRESSION[i] : 1.0;
            info2.alpha = alpha;
            this._layers[i].render(info2);
        }
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
