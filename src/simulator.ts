import { GuillotineArray, LinkedList } from './util';
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
    readonly location: rvec3;
    priority: number;
    delay: number; // in game ticks
    onCompleted: (qt: QTick) => void;
    grid: Grid;
    customData: any;
    isFree: boolean;
    constructor(location: vec3) {
        this.location = vec3.clone(location);
        this.isFree = true;
    }
}

/**
 * Provides a way to look up QTicks by grid coordinate
 */
class QTickGrid {
    _data: Map<number, QTick>;
    constructor() {
        this._data = new Map();
    }
    get(coords: vec3): QTick | undefined {
        return this._data.get(this._hash(coords));
    }
    getOrCreate(coords: vec3): QTick {
        const key = this._hash(coords);
        let qt = this._data.get(key);
        if (!qt) {
            qt = new QTick(coords);
            this._data.set(key, qt);
        }
        return qt;
    }
    // TODO Enforce max grid size; x,y,z E [-2^9,2^9)
    _hash(coords: vec3): number {
        // TODO Better hash function that allows bigger coordinates
        const a = coords[0] + 512;
        const b = coords[1] + 512;
        const c = coords[2] + 512;
        return (a << 0) | (b << 10) | (c << 20);
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
    // Used for O(1) qtick push/remove and O(n) iteration
    activeQticks: LinkedList<QTick>;
    // Used for O(1) qtick lookup by vec3
    qtickGrid: QTickGrid;
    sortedQticks: QTick[];
    tickCount: number;
    blockUpdatePool: BlockUpdate[];
    blockUpdateLength: number;
    tempVec3: vec3;
    tempOut: [Block, number];
    constructor(grid: Grid, installHooks?: boolean) {
        this.grid = grid;
        this.activeQticks = new LinkedList();
        this.qtickGrid = new QTickGrid();
        this.sortedQticks = [];
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
        const iterator = this.activeQticks.iterator();
        while (iterator.hasNext()) {
            const tick = iterator.next();

            // Count down
            tick.delay--;

            // Execute callback if necessary
            if (tick.delay <= 0) {
                iterator.remove();
                this.sortedQticks.push(tick);
            }
        }
        this.sortedQticks.sort((a, b) => a.priority - b.priority);
        for (let i = 0; i < this.sortedQticks.length; i++) {
            const tick = this.sortedQticks[i];
            tick.onCompleted(tick);
            tick.isFree = true;
        }
        this.sortedQticks.splice(0);

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
    //(Outdated) QueueTick setup:
    // 1) Call queueTick() to obtain a QTick object
    //  -> Finds a free QTick object in the queuedTicks array
    //  -> Sets QTick.id to the index in the array
    // 2) Call QTick.set() to set its parameters
    //  -> Sets QTick.isFree to false
    //  -> Now the QTick is ready to be iterated over
    // doGameTick() iterates over QTicks and decrements the timer on free ones.
    // When the timer runs out the callback is called and QTick.isFree is set back to true
    getScheduledQTick(location: vec3): QTick | null {
        const qt = this.qtickGrid.get(location);
        return (qt && !qt.isFree) ? qt : null;
    }
    tryScheduleQTick(location: vec3, delay: number, priority: number, onCompleted: (QTick) => void, customData?: any): boolean {
        const qt = this.qtickGrid.getOrCreate(location);

        if (!qt.isFree) {
            return false;
        }
        qt.priority = priority;
        qt.delay = delay;
        qt.onCompleted = onCompleted;
        qt.grid = this.grid;
        qt.customData = customData;
        qt.isFree = false;
        this.activeQticks.push(qt);

        return true;
        // for (let i = this.queuedTickIndex; i <= this.queuedTicks.length; i++) {
        //     let qt = this.queuedTicks[i];
        //     if (!qt) {
        //         qt = new QTick();
        //         qt.id = i + 1;
        //         if (qt.id > 65535)
        //             throw new Error('Exceeded QTick limit');
        //         this.queuedTicks[i] = qt;
        //     }
        //     if (qt.isFree) {
        //         this.queuedTickLength = max(this.queuedTickLength, i + 1);
        //         return qt;
        //     }
        // }
        // // QTick should be created by now
        // throw new Error('this shouldn\'t happen');
    }
    tryCancelQTick(location: vec3): boolean {
        const qt = this.qtickGrid.getOrCreate(location);
        if (qt.isFree) {
            return false;
        }
        qt.isFree = true;
        this.activeQticks.remove(qt);
        return true;
    }
    // findQTick(id: number): QTick | null {
    //     const index = id - 1;
    //     if (index < 1 || index > this.queuedTickLength) return null;
    //     const qt = this.queuedTicks[index];
    //     return !qt.isFree ? qt : null;
    // }
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
