import { vec3, mat4 } from 'gl-matrix';

export interface Model {
    vertices: vec3[];
    indices: number[];
};

export interface GLModel {
    vertices: Float32Array;
    indices: Uint32Array;
}

export const Model = {
    use: (model: Model, transform?: mat4, flip?: boolean): GLModel => {
        const outVerts = new Array(model.vertices.length * 3);
        const vec = vec3.create();

        for (let i = 0; i < model.vertices.length; i++) {
            if (transform)
                vec3.transformMat4(vec, model.vertices[i], transform);
            
            if (!flip) {
                outVerts[i + 0] = vec[0];
                outVerts[i + 1] = vec[1];
                outVerts[i + 2] = vec[2];
            } else {
                outVerts[i + 2] = vec[2];
                outVerts[i + 1] = vec[1];
                outVerts[i + 0] = vec[0];
            }
        }
        return { vertices: Float32Array.from(outVerts), indices: Uint32Array.from(model.indices) };
    }
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
        0, 3, 1, 1, 3, 2
    ]
};
export const models = { fullBlock };
