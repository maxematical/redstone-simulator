import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { Grid } from './grid';
import { glMatrix, vec3 } from 'gl-matrix';
import { Block, blocks } from './blocks';

interface GridTestContext {
    grid: Grid;
    c1: vec3;
}
const test = anyTest as TestInterface<GridTestContext>;

test.before(t => {
    glMatrix.setMatrixArrayType(Array);
});
test.beforeEach(t => {
    t.context.grid = Grid.new([3, 3, 3]);
    t.context.c1 = [0, 0, 0];
    Grid.set(t.context.grid, t.context.c1, blocks.stone);
});
test('basic grid', t => {
    const grid = Grid.new([1, 2, 3]);
    t.deepEqual([1, 2, 3], grid.size);
    t.deepEqual([0, 0, 0], grid.min);
    t.deepEqual([0, 1, 2], grid.max);
    t.deepEqual(true, grid.isDirty);
});
test('grid get set', t => {
    const { grid, c1 } = t.context;
    const out: [Block, number] = [null, 0];
    Grid.get(grid, c1, out);
    t.is(out[0], blocks.stone);
    t.is(out[1], 0);

    Grid.set(grid, c1, blocks.slab);
    Grid.getN(grid, c1, out);
    t.is(out[0], blocks.slab);
    t.is(out[1], 0);

    Grid.set(grid, c1, null);
    Grid.getN(grid, c1, out);
    t.is(out[0], null);
    t.is(out[1], 0);
});
