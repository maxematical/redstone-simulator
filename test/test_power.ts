import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { Grid } from '../src/grid';
import { glMatrix, vec3 } from 'gl-matrix';
import { Block, blocks } from '../src/blocks';
import { Simulator, getWeakPower, getStrongPower } from '../src/simulator';

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
test('redstone torch hard powers block', t => {
    Grid.set(t.context.grid, t.context.c00, blocks.torch);
    Grid.set(t.context.grid, t.context.u00, blocks.stone);
    
    t.is(0, getWeakPower(t.context.grid, t.context.u00), 'redstone torch doesn\'t send weak power');
    t.is(15, getStrongPower(t.context.grid, t.context.u00), 'redstone torch sends hard power');
});
debugger;
test('redstone dust receives hard power', t => {
    debugger;
    Grid.set(t.context.grid, t.context.c00, blocks.torch);
    Grid.set(t.context.grid, t.context.u00, blocks.stone);
    Grid.set(t.context.grid, t.context.u10, blocks.dust);
    t.context.sim.doGameTick();

    t.is(0xF, Grid.getStateN(t.context.grid, t.context.u10));
});
test('redstone dust weak powers block', t => {
    Grid.set(t.context.grid, [0, 0, 0], blocks.stone);
    Grid.set(t.context.grid, [1, 0, 0], blocks.dust);
    Grid.set(t.context.grid, [2, 0, 0], blocks.torch);
    t.context.sim.doGameTick();

    t.is(15, getWeakPower(t.context.grid, [0, 0, 0]));
    t.is(0, getStrongPower(t.context.grid, [0, 0, 0]));
});
test('redstone torch can turn off by other torch', t => {
    Grid.set(t.context.grid, [0, 0, 0], blocks.torch);
    Grid.set(t.context.grid, [0, 1, 0], blocks.stone);
    Grid.set(t.context.grid, [0, 2, 0], blocks.torch);
    for (let i = 0; i < 4; i++) t.context.sim.doGameTick();
    
    t.is(15, blocks.torch.getPower(Grid.getStateN(t.context.grid, [0, 0, 0])));
    t.is( 0, blocks.torch.getPower(Grid.getStateN(t.context.grid, [0, 2, 0])));
});
test('redstone torch can turn off by dust', t => {
    Grid.set(t.context.grid, [0, 0, 0], blocks.stone);
    Grid.set(t.context.grid, [0, 1, 0], blocks.torch);
    Grid.set(t.context.grid, [1, 0, 0], blocks.dust);
    Grid.set(t.context.grid, [2, 0, 0], blocks.torch);
    for (let i = 0; i < 4; i++) t.context.sim.doGameTick();

    t.is(true, blocks.torch.isEnabled(Grid.getStateN(t.context.grid, [2, 0, 0])));
    t.is(0x4F, blocks.dust.getPower(Grid.getStateN(t.context.grid, [1, 0, 0])));
    t.is(false, blocks.torch.isEnabled(Grid.getStateN(t.context.grid, [0, 1, 0])));
});
