// Reference:
// https://minecraft.gamepedia.com/Mechanics/Redstone
// https://minecraft.gamepedia.com/Block_update
// https://technical-minecraft.fandom.com/wiki/Tile_Tick_Block
// https://technical-minecraft.fandom.com/wiki/0-tick_pulses
// https://old.reddit.com/r/redstone/comments/82dw6x/update_order_list/

import { vec3, ReadonlyVec3 } from 'gl-matrix';
import { Grid } from './grid';
import { Block, blocks } from './blocks';
import directions from './directions';

declare type rvec3 = ReadonlyVec3;

const { min, max } = Math;

export class QTick { // aka "tile tick"
    /** Reset every time its used again from the pool. Always between 1 and 65535 */
    id: number;
    location: vec3;
    priority: number;
    delay: number; // in game ticks
    onCompleted: (qt: QTick) => void;
    isFree: boolean;
    constructor() {
        this.location = vec3.create();
        this.isFree = true;
    }
    set(location: vec3, priority: number, delay: number, onCompleted: (qt: QTick) => void): number {
        vec3.copy(this.location, location);
        this.priority = priority;
        this.delay = delay;
        this.onCompleted = onCompleted;
        this.isFree = false;
        return this.id;
    }
}

export class BlockUpdate {
    readonly location: vec3;
    updateOrder: readonly rvec3[];
    needsSet: boolean;
    constructor() {
        this.location = vec3.create();
        this.updateOrder = null;
        this.needsSet = true;
    }
    set(location: vec3, updateOrder: readonly rvec3[]) {
        vec3.copy(this.location, location);
        this.updateOrder = updateOrder;
        this.needsSet = false;
    }
    setPostPlacement(location: vec3) {
        this.set(location, directions.xwensdu);
    }
}

export class Simulator {
    grid: Grid;
    queuedTicks: QTick[];
    /** The index of the first free queuedTick in the queuedTicks array */
    queuedTickIndex: number;
    queuedTickLength: number;
    tickCount: number;
    blockUpdatePool: BlockUpdate[];
    blockUpdateLength: number;
    tempVec3: vec3;
    tempOut: [Block, number];
    constructor(grid: Grid, installHooks?: boolean) {
        this.grid = grid;
        this.queuedTicks = [];
        this.queuedTickIndex = 0;
        this.queuedTickLength = 0;
        this.tickCount = 0;
        this.blockUpdatePool = [];
        this.blockUpdateLength = 0;
        this.tempVec3 = vec3.create();
        this.tempOut = [null, 0];

        if (installHooks === undefined || installHooks) {
            this._installGridHooks();
        }
    }
    doGameTick() {
        // Execute queued ticks.
        // The order of this follows 2 rules:
        // 1) QTicks with a lower delay are executed first (simple).
        // 2) If two qticks have the same delay, the tick that was queued first happens first.
        // The second property is guaranteed by this code because of the way adding ticks works.
        // This property only comes into play if 2 qticks are added in the same rtick. When _queueTick()
        // is called, the QTick object is placed in the "next queued tick index" and that index
        // is incremented. Within the redstone tick that queued tick index won't change anywhere else.
        // So the qticks are added after each other in order, thus satisfying the second property.
        const len = this.queuedTickLength;
        this.queuedTickLength = 0;
        for (let i = 0; i < len; i++) {
            const tick = this.queuedTicks[i];

            // Update free index
            if (tick.isFree) {
                this.queuedTickIndex = min(this.queuedTickIndex, i);
                continue;
            }

            // Count down
            tick.delay--;

            // Execute callback if necessary
            // Otherwise update length
            if (tick.delay <= 0) {
                tick.onCompleted(tick);
                tick.isFree = true;
            } else {
                this.queuedTickLength = i + 1;
            }
        }

        // Perform redstone tick
        if (this.tickCount++ % 2 === 0) {
            this._doRedstoneTick();
        }
    }
    /**
     * Call to start the process of queuing a block update. The process of queuing the
     * block update is as follows:
     * 1) Call Simulator.queueBlockUpdate() to obtain a BlockUpdate object from the internal pool
     * 2) Call set() or related methods on the BlockUpdate object to set its parameters
     * THe block update will now be queued and executed by the simulator.
     */
    queueBlockUpdate(): BlockUpdate {
        let bu = this.blockUpdatePool[this.blockUpdateLength];
        if (!bu) {
            bu = new BlockUpdate();
            this.blockUpdatePool[this.blockUpdateLength] = bu;
        }
        this.blockUpdateLength++;
        bu.needsSet = true;
        return bu;
    }
    // QueueTick setup:
    // 1) Call queueTick() to obtain a QTick object
    //  -> Finds a free QTick object in the queuedTicks array
    //  -> Sets QTick.id to the index in the array
    // 2) Call QTick.set() to set its parameters
    //  -> Sets QTick.isFree to false
    //  -> Now the QTick is ready to be iterated over
    // doGameTick() iterates over QTicks and decrements the timer on free ones.
    // When the timer runs out the callback is called and QTick.isFree is set back to true
    queueTick(): QTick {
        for (let i = this.queuedTickIndex; i <= this.queuedTicks.length; i++) {
            let qt = this.queuedTicks[i];
            if (!qt) {
                qt = new QTick();
                qt.id = i + 1;
                if (qt.id > 65535)
                    throw new Error('Exceeded QTick limit');
                this.queuedTicks[i] = qt;
            }
            if (qt.isFree) {
                this.queuedTickLength = max(this.queuedTickLength, i + 1);
                return qt;
            }
        }
        // QTick should be created by now
        throw new Error('this shouldn\'t happen');
    }
    findQTick(id: number): QTick | null {
        const index = id - 1;
        if (index < 1 || index > this.queuedTickLength) return null;
        const qt = this.queuedTicks[index];
        return !qt.isFree ? qt : null;
    }
    _doRedstoneTick() {
        const temp = this.tempVec3;
        const out = this.tempOut;
        for (let i = 0; i < this.blockUpdateLength; i++) {
            // Perform the block update
            const bu = this.blockUpdatePool[i];

            if (bu.needsSet) {
                throw new Error('Block update was retrieved from the pool but wasn\'t setup corrctly');
            }

            // Call handleNeighborUpdate on each adjacent block
            for (let j = 0; j < bu.updateOrder.length; j++) {
                vec3.add(temp, bu.location, bu.updateOrder[j]);
                Grid.getN(this.grid, temp, out);
                try {
                    if (out[0])
                        out[0].handleNeighborUpdate(this.grid, temp, out[1], this);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        this.blockUpdateLength = 0;
    }
    _installGridHooks() {
        // Trigger block updates when blocks are placed or destroyed
        this.grid.onSet = (coords: vec3, newBlock: Block | null, newState: number,
                oldBlock: Block | null, oldState: number) => {

            this.queueBlockUpdate().set(coords, directions.x);
            if (oldBlock) oldBlock.updateNeighbors(this.grid, coords, oldState, this);
            if (newBlock) newBlock.updateNeighbors(this.grid, coords, newState, this);
        };
    }
}

const _isOpaque = (grid: Grid, coords: vec3): boolean => {
    const block = Grid.getBlockN(grid, coords);
    return block && !block.isTransparent;
};

export const getWeakPower = (grid: Grid, coords: vec3): number => {
    // Check opaque
    if (!_isOpaque(grid, coords)) return 0;


    // Calculate weak power level
    // A block is weak powered if redstone dust is on top of it or facing into it
    // Check redstone facing into block
    let power = 0;
    const temp = vec3.create();
    for (let i = 0; i < 4; i++) {
        const dir = directions.wens[i];
        vec3.add(temp, coords, dir);
        const block = Grid.getBlockN(grid, temp);
        if (block !== blocks.dust) continue;
        const state = Grid.getStateN(grid, temp);
        vec3.negate(temp, dir);
        if (!blocks.dust.isFacing(state, temp)) continue;
        power = max(power, blocks.dust.getPower(state));
    }
    // Check redstone on top of block
    vec3.add(temp, coords, directions.up);
    const block = Grid.getBlockN(grid, temp);
    if (block === blocks.dust) {
        const state = Grid.getStateN(grid, temp);
        power = max(power, blocks.dust.getPower(state));
    }

    return power;
};

export const getStrongPower = (grid: Grid, coords: vec3): number => {
    // Check opaque
    if (!_isOpaque(grid, coords)) return 0;

    // Calculate strong power level
    let power = 0;
    
    // Redstone torch can strong-power blocks from below
    const below = vec3.create();
    vec3.add(below, coords, directions.down);
    const belowBlock = Grid.getBlockN(grid, below);
    if (belowBlock && belowBlock === blocks.torch) {
        const torchState = Grid.getStateN(grid, below);
        power = max(power, blocks.torch.getPower(torchState));
    }

    // TODO Redstone repeater/comparator

    return power;
};
