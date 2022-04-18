import { blocks } from './blocks';
import { Grid } from './grid';
import { Simulator } from './simulator';

const scenarios: {[key: string]: (grid: Grid, simulator: Simulator) => void} = {};

scenarios['memory-cell'] = ((grid, simulator) => {
    Grid.resize(grid, [0, -1, 0], [3, 2, 0]);
    Grid.set(grid, [0, 0, 0], blocks.dust);
    Grid.set(grid, [1, 0, 0], blocks.stone);
    Grid.set(grid, [2, 0, 0], blocks.torch, 0x1);
    Grid.set(grid, [3, 0, 0], blocks.dust);
    Grid.set(grid, [0, 1, 0], blocks.torch, 0x2 | 0x8);
    Grid.set(grid, [1, 1, 0], blocks.stone);
    Grid.set(grid, [2, 1, 0], blocks.stone);
    Grid.set(grid, [0, -1, 0], blocks.stone);
    Grid.set(grid, [3, -1, 0], blocks.stone);
    for (let i = 0; i < 4; i++) simulator.doGameTick();
    Grid.set(grid, [1, 2, 0], blocks.dust);
    Grid.set(grid, [2, 2, 0], blocks.dust);
    for (let i = 0; i < 2; i++) simulator.doGameTick();
});

scenarios['simple-power'] = ((grid, simulator) => {
    Grid.resize(grid, [0, -1, 0], [3, 0, 0]);
    Grid.set(grid, [0,0,0], blocks.torch);
    for (let x = 0; x < 4; x++)
        Grid.set(grid, [x,-1,0], blocks.stone);
    for (let x = 1; x < 4; x++)
        Grid.set(grid, [x,0,0], blocks.dust);
    simulator.doGameTick();
});

scenarios['inversion'] = ((grid, simulator) => {
    Grid.resize(grid, [-8,-1,-3], [6,0,0]);

    const generate = (off: number, includeTorch: boolean) => {
        if (includeTorch)
            Grid.set(grid, [-1, 0,off], blocks.torch);
        Grid.set(grid, [-1,-1,off], blocks.stone);
        Grid.set(grid, [0, 0,off], blocks.dust);
        Grid.set(grid, [0,-1,off], blocks.stone);
        
        Grid.set(grid, [1, 0,off], blocks.stone);
        Grid.set(grid, [2, 0,off], blocks.torch, 0x1);
        Grid.set(grid, [3, 0,off], blocks.dust);
        Grid.set(grid, [3,-1,off], blocks.stone);
    };
    generate(-3, false);
    generate(0, true);

    for (let i = 0; i < 4; i++)
        simulator.doGameTick();
});

export const loadScenario = (scenarioName: string): [Grid, Simulator] | null => {
    const scenario = scenarios[scenarioName];
    if (!scenario)
        return null;

    const grid = Grid.new([1, 1, 1]);
    const simulator = new Simulator(grid);
    scenario(grid, simulator);
    return [grid, simulator];
};
