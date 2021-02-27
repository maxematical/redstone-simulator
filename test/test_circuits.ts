import { Simulator } from './../src/simulator';
import { Grid } from './../src/grid';
import { glMatrix, vec3 } from 'gl-matrix';
import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { blocks } from '../src/blocks';

interface TestContext {
    grid: Grid;
    sim: Simulator;
}

const test = anyTest as TestInterface<TestContext>;

/**
 * Performs 5 redstone ticks and checks that the states of the blocks at the given locations don't
 * change during this time. This can be used primarily to check if the circuit is stable and signals
 * aren't changing.
 * @param t the execution context containing grid and simulator
 * @param watchLocations locations to watch and make sure states aren't changing
 */
const checkStableCircuit = (t: ExecutionContext<TestContext>, watchLocations: vec3[]) => {
    const initialStates = watchLocations.map(loc => Grid.getStateN(t.context.grid, loc));
    for (let i = 0; i < 10; i++) {
        t.context.sim.doGameTick();
        for (let j = 0; j < watchLocations.length; j++) {
            const message = 'Non-stable circuit at location ' + watchLocations[j];
            t.is(Grid.getStateN(t.context.grid, watchLocations[j]), initialStates[j], message);
        }
    }
};

test.before(t => glMatrix.setMatrixArrayType(Array));
test.beforeEach(t => {
    t.context.grid = Grid.new([11, 11, 11], [-5, -5, -5]);
    t.context.sim = new Simulator(t.context.grid);
});
test('rs latch 1', t => {
    Grid.set(t.context.grid, [0, 0, 0], blocks.dust);
    Grid.set(t.context.grid, [1, 0, 0], blocks.stone);
    Grid.set(t.context.grid, [2, 0, 0], blocks.torch, 0x1);
    Grid.set(t.context.grid, [3, 0, 0], blocks.dust);
    Grid.set(t.context.grid, [0, 1, 0], blocks.torch, 0x2 | 0x8);
    Grid.set(t.context.grid, [1, 1, 0], blocks.stone);
    Grid.set(t.context.grid, [2, 1, 0], blocks.stone);
    // Grid.set(t.context.grid, [3, 1, 0], blocks.stone);
    for (let i = 0; i < 4; i++) t.context.sim.doGameTick();
    Grid.set(t.context.grid, [1, 2, 0], blocks.dust);
    Grid.set(t.context.grid, [2, 2, 0], blocks.dust);
    for (let i = 0; i < 2; i++) t.context.sim.doGameTick();
    const testA: vec3 = [0, 0, 0];
    const testB: vec3 = [3, 0, 0];
    const testLocs = [testA, testB];
    const setA: vec3 = [-1, 0, 0];
    const setB: vec3 = [3, 2, 0];

    checkStableCircuit(t, testLocs);

    // At the beginning, A should be set and B should be unset
    t.is(Grid.getStateN(t.context.grid, testA) & 0xF, 15);
    t.is(Grid.getStateN(t.context.grid, testB) & 0xF, 0);
    
    // Set B
    Grid.set(t.context.grid, setB, blocks.torch, 0x5);
    for (let i = 0; i < 6; i++) t.context.sim.doGameTick();
    Grid.set(t.context.grid, setB, null);
    for (let i = 0; i < 2; i++) t.context.sim.doGameTick();
    t.is(Grid.getStateN(t.context.grid, testA) & 0xF, 0);
    t.is(Grid.getStateN(t.context.grid, testB) & 0xF, 15);
    checkStableCircuit(t, testLocs);

    // Set A
    Grid.set(t.context.grid, setA, blocks.torch, 0x5);
    for (let i = 0; i < 6; i++) t.context.sim.doGameTick();
    Grid.set(t.context.grid, setA, null);
    for (let i = 0; i < 2; i++) t.context.sim.doGameTick();
    t.is(Grid.getStateN(t.context.grid, testA) & 0xF, 15);
    t.is(Grid.getStateN(t.context.grid, testB) & 0xF, 0);
    checkStableCircuit(t, testLocs);
});
