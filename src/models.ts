import { vec3, mat4 } from 'gl-matrix';

export interface Model {
    vertices: vec3[];
    indices: number[];
};

export interface GLModel {
    vertexData: Float32Array;
    indices: Uint32Array;
}

export const Model = {
    // Could need more strict testing, seems to be working
    /**
     * Transforms a normal Model into a GLModel that is easier to use for rendering.
     * @param model The model to use
     * @param extraData Additional data corresponding to each vertex. The final GLModel's data
     * array consists of the vertex XYZ coordinates then the extraData element(s) corresponding to that vertex.
     * Can be used e.g. for UVs
     * @param transform Matrix transform to apply to each vertex
     * @param flip If true, all faces will be flipped
     */
    use: (model: Model, extraData?: { nPerVertex: number, data: number[] }, transform?: mat4, flip?: boolean): GLModel => {
        if (extraData && extraData.data.length / extraData.nPerVertex !== model.vertices.length) {
            const expectedAmount = extraData.nPerVertex * model.vertices.length;
            const gotAmount = extraData.data.length;
            throw Error(`Wrong amount of extra data; expected ${expectedAmount} at ${extraData.nPerVertex}/vertex, got ${gotAmount}`);
        }

        const step = 3 + ((extraData && extraData.nPerVertex) || 0);
        const outVerts = new Array(model.vertices.length * step);
        const vec = vec3.create();

        for (let i = 0; i < model.vertices.length; i++) {
            vec3.copy(vec, model.vertices[i]);
            if (transform)
                vec3.transformMat4(vec, vec, transform);
            
            if (!flip) {
                outVerts[i * step + 0] = vec[0];
                outVerts[i * step + 1] = vec[1];
                outVerts[i * step + 2] = vec[2];
            } else {
                outVerts[i * step + 0] = vec[2];
                outVerts[i * step + 1] = vec[1];
                outVerts[i * step + 2] = vec[0];
            }

            if (extraData) {
                const index = extraData.nPerVertex * i;
                for (let j = 0; j < extraData.nPerVertex; j++) {
                    outVerts[i * step + 3 + j] = extraData.data[index + j];
                }
            }
        }
        return {
            vertexData: Float32Array.from(outVerts),
            indices: Uint32Array.from(model.indices),
        };
    }
};

const triangle: Model = {
    vertices: [
        [-0.5, -0.5, 0.0],
        [0.5, -0.5, 0.0],
        [0.0, 0.5, 0.0]
    ],
    indices: [
        0, 1, 2
    ]
};
const fullBlock: Model = {
    vertices: [
        /*
         * +-> X
         * |
         * v Z
         * 
         * Top
         * 4+++++5
         * |     |
         * |     |
         * 7+++++6
         * 
         * Bottom
         * 0+++++1
         * |     |
         * |     |
         * 3+++++2
         * */
        [0, 0, 0], [1, 0, 0],
        [1, 0, 1], [0, 0, 1],
        [0, 1, 0], [1, 1, 0],
        [1, 1, 1], [0, 1, 1]
    ],
    indices: [
        // Top
        4, 7, 5, 5, 7, 6,
        // -X side
        4, 0, 7, 7, 0, 3,
        // +X side
        6, 2, 5, 5, 2, 1,
        // -Z side
        5, 1, 4, 4, 1, 0,
        // +Z side
        7, 3, 6, 6, 3, 2,
        // Bottom
        0, 1, 3, 3, 1, 2
    ]
};
export const models = { triangle, fullBlock };
