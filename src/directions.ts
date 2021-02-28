import { vec3, ReadonlyVec3 } from 'gl-matrix';

const { sign } = Math;

const west: ReadonlyVec3 = vec3.fromValues(-1, 0, 0);
const east: ReadonlyVec3 = vec3.fromValues(1, 0, 0);
const down: ReadonlyVec3 = vec3.fromValues(0, -1, 0);
const up: ReadonlyVec3 = vec3.fromValues(0, 1, 0);
const north: ReadonlyVec3 = vec3.fromValues(0, 0, -1);
const south: ReadonlyVec3 = vec3.fromValues(0, 0, 1);

const none: ReadonlyVec3 = vec3.fromValues(0, 0, 0);

const wens: readonly ReadonlyVec3[] = [west, east, north, south];
const weduns: readonly ReadonlyVec3[] = [west, east, down, up, north, south];
const wensdu: readonly ReadonlyVec3[] = [west, east, north, south, down, up];
const xwensdu: readonly ReadonlyVec3[] = [none, west, east, north, south, down, up];
const wensu: readonly ReadonlyVec3[] = [west, east, north, south, up];
const x: readonly ReadonlyVec3[] = [none];

const checkCardinalVector = (dir: ReadonlyVec3) => {
    const nComponents = (dir[0] !== 0 ? 1 : 0) + (dir[1] !== 0 ? 1 : 0) + (dir[2] !== 0 ? 1 : 0);
    if (nComponents !== 1) {
        throw new Error(`Not a cardinal direction vector: [${dir[0]}, ${dir[1]}, ${dir[2]}]`);
    }
};

export class DirectionMap {
    values: boolean[];
    constructor(directionList: readonly ReadonlyVec3[]) {
        this.values = new Array(6);
        for (let i = 0; i < 6; i++) this.values[i] = false;

        for (let i = 0; i < directionList.length; i++) {
            const dir = directionList[i];
            for (let j = 0; j < 6; j++)
                if (equals(weduns[j], dir)) this.values[j] = true;
        }
    }
    query(dir: ReadonlyVec3): boolean {
        if (equals(dir, west)) return this.values[0];
        else if (equals(dir, east)) return this.values[1];
        else if (equals(dir, down)) return this.values[2];
        else if (equals(dir, up)) return this.values[3];
        else if (equals(dir, north)) return this.values[4];
        else if (equals(dir, south)) return this.values[5];
        else return false;
    }
};

const equals = (dir1: ReadonlyVec3, dir2: ReadonlyVec3) => (
    sign(dir1[0]) === sign(dir2[0]) &&
    sign(dir1[1]) === sign(dir2[1]) &&
    sign(dir1[2]) === sign(dir2[2]));

const arrContains = (arr: readonly ReadonlyVec3[], dir: ReadonlyVec3): boolean => {
    for (let i = 0; i < arr.length; i++) {
        if (equals(dir, arr[i]))
            return true;
    }
    return false;
};

export default { west, east, down, up, north, south, none,
        wens, weduns, wensdu, xwensdu, wensu, x,
        checkCardinalVector, equals, arrContains };
