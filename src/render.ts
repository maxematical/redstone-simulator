import { vec3 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel } from './models';
import { Block, Blocks } from './blocks';

declare var gl: WebGL2RenderingContext;

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
    id: number;
    nModels: number;

    /** Called to render for a single block in a grid. Add models to the ModelCombiner */
    render(grid: Grid, coords: vec3, block: Block, state: number, out: ModelCombiner);

    /** Called to create a BlockGLRenderer that corresponds to this BlockRenderer */
    createBlockGLRenderer(): BlockGLRenderer;
}

/**
 * Manages rendering for a single block type. There will be one of these per BlockRenderer,
 * per GridRenderer. Will handle VBOs/EBOs and directly interface with OpenGL.
 */
export interface BlockGLRenderer {
    init();

    /**
     * The models that sent to the render function are combined and given to this function so that they can be
     * uploaded to the GPU.
     */
    uploadCombinedModel(model: GLModel);

    /** Called to render the combined model, I.e. the final step in rendering this particular type of block. */
    renderCombinedModel(info: GLRenderInfo);
}

export interface GridRenderer {
    _combiners: ModelCombiner[]; // 1 combiner per BlockRenderer
    _subrenderers: BlockGLRenderer[]; // 1 BlockGLRenderer per BlockRenderer
}

export const GridRenderer = {
    new: (): GridRenderer => ({ _combiners: [], _subrenderers: [] }),

    update: (self: GridRenderer, grid: Grid): void => {
        // 0) Setup
        for (let i = 0; i < self._combiners.length; i++) {
            if (self._combiners[i])
                ModelCombiner.clear(self._combiners[i]);
        }

        // 1) Call block renderers and add into model combiners
        const xyz = vec3.create();
        const out: [Block, number] = [null, 0];
        for (let x = grid.min[0]; x <= grid.max[0]; x++) {
            for (let y = grid.min[1]; y <= grid.max[1]; y++) {
                for (let z = grid.min[2]; z <= grid.max[2]; z++) {
                    vec3.set(xyz, x, y, z);
                    Grid.getNullable(grid, xyz, out);
                    const [block, state] = out;
                    if (!block) continue;
                    const modelCombiner = GridRenderer._getOrCreateCombiner(self, block.renderer);
                    block.renderer.render(grid, xyz, block, state, modelCombiner);
                }
            }
        }

        // 2) Accumulate block renderers into final models
        for (let i = 0; i < self._combiners.length; i++) {
            const combiner = self._combiners[i];
            if (combiner) {
                const model = ModelCombiner.combine(combiner);
                console.log('Combined model', model, combiner);
                
                let subrenderer: BlockGLRenderer = self._subrenderers[i];
                if (!subrenderer) {
                    subrenderer = Blocks.byId(i).renderer.createBlockGLRenderer();
                    subrenderer.init();
                    self._subrenderers[i] = subrenderer;
                }
                subrenderer.uploadCombinedModel(model);
            }
        }
    },

    render: (self: GridRenderer, info: GLRenderInfo) => {
        // Go through each subrenderer and draw those blocks
        for (let i = 0; i < self._subrenderers.length; i++) {
            const subrenderer = self._subrenderers[i];
            if (subrenderer) {
                subrenderer.renderCombinedModel(info);
            }
        }
    },

    _getOrCreateCombiner: (self: GridRenderer, br: BlockRenderer): ModelCombiner => {
        const id = br.id;
        if (self._combiners[id]) {
            return self._combiners[id];
        } else {
            const combiner = ModelCombiner.new();
            self._combiners[id] = combiner;
            return combiner;
        }
    }
};

export interface GLRenderInfo {
    mvp: Float32List;
}
