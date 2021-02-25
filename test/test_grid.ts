import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { Grid } from '../src/grid';
import { glMatrix, vec3 } from 'gl-matrix';
import { Block, blocks } from '../src/blocks';

interface TestContext {
    grid: Grid;
    c1: vec3;
}
const test = anyTest as TestInterface<TestContext>;

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
test('grid resize', t => {
    Grid.set(t.context.grid, [0, 0, 0], blocks.stone);
    Grid.resize(t.context.grid, [-2, -2, -2], [2, 2, 2]);

    t.deepEqual(t.context.grid.size, [5, 5, 5]);
    t.deepEqual(t.context.grid.min, [-2, -2, -2]);
    t.deepEqual(t.context.grid.max, [2, 2, 2]);

    const out: [Block, number] = [null, 0];
    Grid.get(t.context.grid, [0, 0, 0], out);
    t.is(out[0], blocks.stone);
});
