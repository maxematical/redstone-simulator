import { Block, blocks } from './blocks';
import { vec3 } from 'gl-matrix';

export interface Grid {
    size: vec3;
    min: vec3,
    max: vec3, // inclusive
    data: number[];
};

const { min, max } = Math;

export const Grid = {
    new: (size: vec3, min?: vec3): Grid => {
        Grid._sizeCheck(size);
        min = min || vec3.fromValues(0, 0, 0);
        const max = vec3.fromValues(-1, -1, -1);
        vec3.add(max, max, size);
        vec3.add(max, max, min); // max = min + size - [1,1,1]
        return {
            size,
            min,
            max,
            data: Grid._createData(size)
        };
    },

    /** Resize the grid. The current origin will be kept */
    // This HAs nOt been Tested Yet!!!!!!!
    resize: (grid: Grid, newMin: vec3, newMax: vec3) => {
        const newSize = vec3.create();
        vec3.sub(newSize, newMax, newMin);
        vec3.add(newSize, newSize, [1, 1, 1]);
        const newData = Grid._createData(newSize);

        const mins = vec3.create();
        const maxs = vec3.create();
        vec3.min(mins, grid.min, newMin);
        vec3.max(maxs, grid.max, newMax);
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
                        newData[newI + 1] = grid.data[oldI + 1];
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
        return (xx + (yy * size[0]) + (zz * size[1] * size[0])) * 2;
    },

    get: (grid: Grid, xyz: vec3, out: [Block, number]) => Grid._get(grid, xyz, out, false),

    getN: (grid: Grid, xyz: vec3, out: [Block, number]) => Grid._get(grid, xyz, out, true),

    getBlockN: (grid: Grid, xyz: vec3): Block => {
        if (!Grid.inBounds(grid, xyz)) return null;
        const out: [Block, number] = [null, 0];
        Grid._get(grid, xyz, out, true);
        return out[0];
    },

    _get: (grid: Grid, xyz: vec3, out: [Block, number], allowNull: boolean) => {
        if (allowNull)
            if (!Grid.inBounds(grid, xyz)) return null;
        else
            Grid._boundsCheck(grid, xyz);
        const index = Grid.index(grid, xyz);
        out[0] = blocks.byId(grid.data[index], allowNull);
        out[1] = grid.data[index + 1];
    },

    set: (grid: Grid, xyz: vec3, block: Block | null, state?: number) => {
        Grid._boundsCheck(grid, xyz);
        const index = Grid.index(grid, xyz);
        grid.data[index] = block ? block.id : 0;
        grid.data[index + 1] = state || 0;
    },

    _boundsCheck: (grid: Grid, xyz: vec3) => {
        if (!Grid.inBounds(grid, xyz)) {
            console.error('Attempted to access out-of-bounds grid coordinate, details:',
                'Grid:', grid, 'Coordinates:', xyz);
            throw new Error('Attempted to access out-of-bounds grid coordinate');
        }
    },

    _sizeCheck: (size: vec3) => {
        if (size[0] <= 0 || size[1] <= 0 || size[2] <= 0) {
            console.error('Grid size is too small:', size);
            throw new Error('Grid sizde is too small');
        }
    },

    _createData: (size: vec3): number[] => {
        const data = new Array(size[0] * size[1] * size[2] * 2)
        for (let i = 0; i < data.length; i++) {
            data[i] = 0;
        }
        return data;
    }
};
