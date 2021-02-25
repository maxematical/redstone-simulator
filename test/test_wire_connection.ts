import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { Grid } from '../src/grid';
import { glMatrix, vec3 } from 'gl-matrix';
import { Block, blocks } from '../src/blocks';
import { Simulator } from '../src/simulator';

interface TestContext {
    grid: Grid;
    c00: vec3;
    c10: vec3;
    c01: vec3;
    c11: vec3;
    u00: vec3;
    u10: vec3;
    sim: Simulator;
}
const test = anyTest as TestInterface<TestContext>;

test.before(() => glMatrix.setMatrixArrayType(Array));
test.beforeEach(t => {
    t.context.grid = Grid.new([3, 3, 3]);
    t.context.c00 = [0, 0, 0];
    t.context.c10 = [1, 0, 0];
    t.context.c01 = [0, 0, 1];
    t.context.c11 = [1, 0, 1];
    t.context.u00 = [0, 1, 0];
    t.context.u10 = [1, 1, 0];
    t.context.sim = new Simulator(t.context.grid);
});

test('connect in line', t => {
    Grid.set(t.context.grid, t.context.c00, blocks.dust);
    Grid.set(t.context.grid, t.context.c10, blocks.dust);
    t.context.sim.doGameTick();

    const out: [Block, number] = [null, 0];
    Grid.get(t.context.grid, t.context.c00, out);
    t.is(out[1], 0x40, 'western wire should be connected to the east');
    Grid.get(t.context.grid, t.context.c10, out);
    t.is(out[1], 0x80, 'eastern wire should be connected to the west');
});
test('connect in corner', t => {
    Grid.set(t.context.grid, t.context.c00, blocks.dust);
    Grid.set(t.context.grid, t.context.c10, blocks.dust);
    Grid.set(t.context.grid, t.context.c11, blocks.dust);
    t.context.sim.doGameTick();

    const out: [Block, number] = [null, 0];
    Grid.get(t.context.grid, t.context.c00, out);
    t.is(out[1], 0x40, 'western wire should be connected to the east');
    Grid.get(t.context.grid, t.context.c10, out);
    t.is(out[1], 0x80 | 0x10, 'middle wire should be connected to the east and south');
    Grid.get(t.context.grid, t.context.c11, out);
    t.is(out[1], 0x20, 'southern wire should be connected to the north');
});
test('connect upwards', t => {
    Grid.set(t.context.grid, t.context.c00, blocks.dust);
    Grid.set(t.context.grid, t.context.u10, blocks.dust);
    t.context.sim.doGameTick();

    const out: [Block, number] = [null, 0];
    Grid.get(t.context.grid, t.context.c00, out);
    t.is(out[1], 0x440, 'lower wire should connect up and to the east');
    Grid.get(t.context.grid, t.context.u10, out);
    t.is(out[1], 0x080, 'upper wire should connect to the west');
});
test('pinch', t => {
    Grid.set(t.context.grid, t.context.c00, blocks.dust);
    Grid.set(t.context.grid, t.context.u10, blocks.dust);
    Grid.set(t.context.grid, t.context.u00, blocks.stone);
    t.context.sim.doGameTick();

    const out: [Block, number] = [null, 0];
    Grid.get(t.context.grid, t.context.c00, out);
    t.is(out[1], 0, 'pinched wire should not be connected');
    Grid.get(t.context.grid, t.context.u10, out);
    t.is(out[1], 0, 'pinched wire should not be connected');
});
