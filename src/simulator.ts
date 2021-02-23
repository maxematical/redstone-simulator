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

interface QTick { // aka "tile tick"
    priority: number;
    location: rvec3;
    delay: number; // in game ticks
    onCompleted: () => void;
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
    nextQueuedTickIndex: number;
    tickCount: number;
    blockUpdatePool: BlockUpdate[];
    blockUpdateLength: number;
    tempVec3: vec3;
    tempOut: [Block, number];
    constructor(grid: Grid) {
        this.grid = grid;
        this.queuedTicks = [];
        this.nextQueuedTickIndex = 0;
        this.tickCount = 0;
        this.blockUpdatePool = [];
        this.blockUpdateLength = 0;
        this.tempVec3 = vec3.create();
        this.tempOut = [null, 0];
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
        for (let i = 0; i < this.queuedTicks.length; i++) {
            const tick = this.queuedTicks[i];
            if (!tick) {
                if (i < this.nextQueuedTickIndex)
                    this.nextQueuedTickIndex = i;
                continue;
            }
            tick.delay--;
            if (tick.delay <= 0) {
                tick.onCompleted();
                this.queuedTicks[i] = null;
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
    _queueTick(tick: QTick) {
        for (let i = this.nextQueuedTickIndex; i <= this.queuedTicks.length; i++) {
            if (!this.queuedTicks[i]) {
                this.queuedTicks[i] = tick;
                this.nextQueuedTickIndex++;
                return;
            }
        }
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
}

export const checkHardPowered = (grid: Grid, coords: vec3): number => 0; // TODO
