import { vec3 } from 'gl-matrix';

export interface Grid {
    size: vec3;
    min: vec3,
    max: vec3, // inclusive
    data: boolean[];
};

const { min, max } = Math;

export const Grid = {
    new: (size: vec3): Grid => ({
        size,
        min: vec3.fromValues(0, 0, 0),
        max: vec3.fromValues(1, 1, 1),
        data: Grid._createData(size),
    }),

    /** Resize the grid. The current origin will be kept */
    // This HAs nOt been Tested Yet!!!!!!!
    resize: (grid: Grid, newMin: vec3, newMax: vec3) => {
        const newSize = vec3.create();
        vec3.sub(newSize, newMax, newMin);
        vec3.add(newSize, newSize, [1, 1, 1]);
        const newData = Grid._createData(newSize);

        const mins = [0, 1, 2].map(i => min(grid.min[i], newMin[i]));
        const maxs = [0, 1, 2].map(i => max(grid.max[i], newMax[i]));
        const xyz = vec3.create();
        for (let x = mins[0]; x <= maxs[0]; x++) {
            for (let y = mins[1]; y <= maxs[1]; y++) {
                for (let z = mins[2]; z <= maxs[2]; z++) {
                    vec3.set(xyz, x, y, z);

                    // Copy from old data to new data
                    if (Grid._inBounds(grid.min, grid.max, xyz) && Grid._inBounds(newMin, newMax, xyz)) {
                        const oldI = Grid.index(grid, xyz);
                        const newI = Grid._index(newMin, newSize, xyz);
                        newData[newI] = grid.data[oldI];
                    }
                }
            }
        }

        grid.size = newSize;
        grid.min = newMin;
        grid.max = newMax;
        grid.data = newData;
    },

    inBounds: (grid: Grid, xyz: vec3): boolean => Grid._inBounds(grid.min, grid.max, xyz),

    _inBounds: (min: vec3, max: vec3, xyz: vec3): boolean => (
        xyz[0] >= min[0] && xyz[1] >= min[1] && xyz[2] >= min[2] &&
        xyz[0] <= max[0] && xyz[1] <= max[1] && xyz[2] <= max[2]),

    index: (grid: Grid, xyz: vec3): number => Grid._index(grid.min, grid.size, xyz),

    _index: (min: vec3, size: vec3, xyz: vec3): number => {
        const xx = xyz[0] - min[0];
        const yy = xyz[1] - min[1];
        const zz = xyz[2] - min[2];
        return xx + (yy * size[0]) + (zz * size[1] * size[0]);
    },

    get: (grid: Grid, xyz: vec3): boolean => {
        Grid._boundsCheck(grid, xyz);
        return grid.data[Grid.index(grid, xyz)]
    },

    set: (grid: Grid, xyz: vec3, value: boolean) => {
        Grid._boundsCheck(grid, xyz);
        grid.data[Grid.index(grid, xyz)] = value;
    },

    _boundsCheck: (grid: Grid, xyz: vec3) => {
        if (!Grid.inBounds(grid, xyz)) {
            console.error('Attempted to access out-of-bounds grid coordinate, details:',
                'Grid:', grid, 'Coordinates:', xyz);
            throw new Error('Attempted to access out-of-bounds grid coordinate');
        }
    },

    _createData: (size: vec3): boolean[] => new Array(size[0] * size[1] * size[2])
};
