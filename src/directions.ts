import { vec3, ReadonlyVec3 } from 'gl-matrix';

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

export default { west, east, down, up, north, south, none, wens, weduns, wensdu, xwensdu, wensu, x, checkCardinalVector };
