import { vec3, mat4 } from 'gl-matrix';

export interface Model {
    vertices: vec3[];
    indices: number[];
};

export interface GLModel {
    vertexData: Float32Array;
    indices: Uint32Array;
    dataPerVertex: number;
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

            outVerts[i * step + 0] = vec[0];
            outVerts[i * step + 1] = vec[1];
            outVerts[i * step + 2] = vec[2];

            if (extraData) {
                const index = extraData.nPerVertex * i;
                for (let j = 0; j < extraData.nPerVertex; j++) {
                    outVerts[i * step + 3 + j] = extraData.data[index + j];
                }
            }
        }

        // Flip indices
        let indices: Uint32Array;
        if (!flip) {
            indices = Uint32Array.from(model.indices);
        } else {
            indices = new Uint32Array(model.indices.length);
            for (let i = 0; i < indices.length; i += 3) {
                for (let j = 0; j < 3; j++) {
                    indices[i + j] = model.indices[i + (2 - j)];
                }
            }
        }

        return {
            vertexData: Float32Array.from(outVerts),
            indices,
            dataPerVertex: step
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
const cube: Model = {
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
         * Bottom       (Looking from top)
         * 0+++++1      1+++++0
         * |     |      |     |
         * |     |      |     |
         * 3+++++2      2+++++3
         * */
        [0, 0, 0], [1, 0, 0],
        [1, 0, 1], [0, 0, 1],
        [0, 1, 0], [1, 1, 0],
        [1, 1, 1], [0, 1, 1]
    ],
    indices: [
        // Top
        4, 7, 5, 5, 7, 6,
        //7, 6, 4, 4, 6, 5,
        // -X side
        4, 0, 7, 7, 0, 3,
        // +X side
        6, 2, 5, 5, 2, 1,
        // -Z side
        5, 1, 4, 4, 1, 0,
        // +Z side
        7, 3, 6, 6, 3, 2,
        // Bottom
        1, 2, 0, 0, 2, 3
    ]
};

// Similar to the cube model, but doesn't share vertices between its sides, allowing to put UVs on vertices
const texturedCube: Model = { vertices: [], indices: [] };
let k = 0;
for (let i = 0; i < cube.indices.length / 6; i++) {
    const ii = i * 6;
    texturedCube.vertices.push(cube.vertices[cube.indices[ii]]);
    texturedCube.vertices.push(cube.vertices[cube.indices[ii + 1]]);
    texturedCube.vertices.push(cube.vertices[cube.indices[ii + 2]]);
    texturedCube.vertices.push(cube.vertices[cube.indices[ii + 5]]);
    texturedCube.indices.push(k);
    texturedCube.indices.push(k + 1);
    texturedCube.indices.push(k + 2);
    texturedCube.indices.push(k + 2);
    texturedCube.indices.push(k + 1);
    texturedCube.indices.push(k + 3);
    k += 4;
}

export const models = { triangle, cube, texturedCube };
