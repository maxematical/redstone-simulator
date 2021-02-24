import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { Grid } from './grid';
import { glMatrix, vec3 } from 'gl-matrix';
import { Block, blocks } from './blocks';
import { Simulator } from './simulator';

interface TestContext {
    grid: Grid;
    c00: vec3;
    c10: vec3;
    c20: vec3;
    c30: vec3;
    c40: vec3;
    c01: vec3;
    c11: vec3;
    u00: vec3;
    u10: vec3;
    sim: Simulator;
}
const test = anyTest as TestInterface<TestContext>;

test.before(() => glMatrix.setMatrixArrayType(Array));
test.beforeEach(t => {
    t.context.grid = Grid.new([5, 5, 5]);
    t.context.c00 = [0, 0, 0];
    t.context.c10 = [1, 0, 0];
    t.context.c20 = [2, 0, 0];
    t.context.c30 = [3, 0, 0];
    t.context.c40 = [4, 0, 0];
    t.context.c01 = [0, 0, 1];
    t.context.c11 = [1, 0, 1];
    t.context.u00 = [0, 1, 0];
    t.context.u10 = [1, 1, 0];
    t.context.sim = new Simulator(t.context.grid);
});

test('dust is powered by torch', t => {
    Grid.set(t.context.grid, [0, 0, 0], blocks.torch);
    t.context.sim.doGameTick();
    Grid.set(t.context.grid, [1, 0, 0], blocks.dust);
    t.context.sim.doGameTick();

    t.is(15, Grid.getStateN(t.context.grid, [1, 0, 0]) & 0xF);
});
test('dust power fades over distance', t => {
    for (let x = 0; x < 5; x++) Grid.set(t.context.grid, [x, 0, 0], blocks.stone);
    Grid.set(t.context.grid, [0, 1, 0], blocks.torch);
    for (let x = 1; x < 5; x++) Grid.set(t.context.grid, [x, 1, 0], blocks.dust);
    t.context.sim.doGameTick();
    
    t.is(15, Grid.getStateN(t.context.grid, [1, 1, 0]) & 0xF);
    t.is(14, Grid.getStateN(t.context.grid, [2, 1, 0]) & 0xF);
    t.is(13, Grid.getStateN(t.context.grid, [3, 1, 0]) & 0xF);
    t.is(12, Grid.getStateN(t.context.grid, [4, 1, 0]) & 0xF);
});
