import { vec3 } from 'gl-matrix';
import { Grid } from './grid';
import { GLModel } from './models';
import { BlockRenderer } from './render';

/** Defines a type of block. There is one instance of these per TYPE of block (not per block). */
export interface Block {
    id: number;
    renderer: BlockRenderer;
}

export const Blocks = {
    byId: (id: number) => null as Block
};
