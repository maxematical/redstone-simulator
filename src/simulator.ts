// Reference:
// https://minecraft.gamepedia.com/Mechanics/Redstone
// https://minecraft.gamepedia.com/Block_update
// https://technical-minecraft.fandom.com/wiki/Tile_Tick_Block
// https://technical-minecraft.fandom.com/wiki/0-tick_pulses
// https://old.reddit.com/r/redstone/comments/82dw6x/update_order_list/

import { vec3 } from 'gl-matrix';
import { Grid } from './grid';
import { Block, blocks } from './blocks';

interface QTick { // aka "tile tick"
    priority: number;
    location: vec3;
    delay: number; // in game ticks
    onCompleted: () => void;
}

class Simulator {
    grid: Grid;
    queuedTicks: QTick[];
    nextQueuedTickIndex: number;
    tickCount: number;
    constructor(grid: Grid) {
        this.grid = grid;
        this.queuedTicks = [];
        this.nextQueuedTickIndex = 0;
        this.tickCount = 0;
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
    _doRedstoneTick() {

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
}

export default Simulator;
