import { vec3 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel } from './models';
import { Block, Blocks } from './blocks';
import { materialRegistry } from './materials';
import tuple from './tuples';

declare var gl: WebGL2RenderingContext;

const { abs, min, max } = Math;

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
        console.log('in combine()', vertexData, indices);
        return {
            vertexData: Float32Array.from(vertexData),
            indices: Uint32Array.from(indices),
            dataPerVertex: null
        };
    },

    clear: (self: ModelCombiner): void => {
        self._modelBuffer.splice(0);
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
    _materials: {[materialName: string]: [ModelCombiner, MaterialRenderer]};
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
    [key: string]: any; // any additional info needed for rendering
}

const ALPHA_REGRESSION = [1.0, 0.3, 0.1];
export class LayeredGridRenderer {
    _layers: LayerRenderer[];
    _facingAxis: vec3;
    _centerPos: vec3;
    _selectedLayer: number; // debug purposes
    constructor() {
        this._layers = new Array(3);
        this._layers[0] = new LayerRenderer();
        this._layers[1] = new LayerRenderer();
        this._layers[2] = new LayerRenderer();
        this._facingAxis = vec3.create();
        this._centerPos = vec3.create();
        this._selectedLayer = 0;
    }
    setCamera(facingAxis: vec3, centerPos: vec3) {
        vec3.copy(this._facingAxis, facingAxis);
        vec3.copy(this._centerPos, centerPos);
    }
    updateModels(grid: Grid) {
        const f = this._facingAxis;
        const c = this._centerPos;
        //const k = abs(f[0]) * c[0] + abs(f[1]) * c[1] + abs(f[2]) * c[2]; // the coordinate of centerPos along the facing-axis
        const k = vec3.dot(f, c);
        this._layers[0].updateModels(grid, this._facingAxis, k);
        this._layers[1].updateModels(grid, this._facingAxis, k - 1, k - 1);
        this._layers[2].updateModels(grid, this._facingAxis, k - 2, k - 2);
    }
    render(info: GLRenderInfo) {
        // const info2 = { ...info, alpha: 1.0 - 0.3 * this._selectedLayer };
        // this._layers[this._selectedLayer].render(info2);
        const info2 = { ...info, alpha: 0.0 };
        for (let i = 0; i < 3; i++) {
            info2.alpha = ALPHA_REGRESSION[i];
            this._layers[i].render(info2);
        }
    }
}
