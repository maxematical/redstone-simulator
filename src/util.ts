const { min, max } = Math;

export const clamp = (x: number, a: number, b: number): number => max(a, min(b, x));

/**
 * Similar to a normal array, but provides O(1) remove-at-head capability.
 */
// TODO unit test this
export class GuillotineArray<T> {
    _data: T[];
    _startIndex: number;
    _lastIndexExclusive: number;
    constructor(initialCapacity?: number) {
        this._data = new Array(initialCapacity || 16);
        this._startIndex = 0;
        this._lastIndexExclusive = 0;
    }
    get(index: number): T | undefined {
        const internalIndex = (index + this._startIndex) % this._data.length;
        return this._data[internalIndex];
    }
    set(index: number, value: T) {
        if (index >= this._data.length)
            this._resize(index + 1);
        this._data[this._lastIndexExclusive] = value;
        this._lastIndexExclusive++;
        this._lastIndexExclusive %= this._data.length;
    }
    push(value: T) {
        this.set(this.length(), value);
    }
    popHead(): T {
        if (this._startIndex === this._lastIndexExclusive)
            throw new Error('Array is empty');
        const oldHead = this._data[this._startIndex];
        this._data[this._startIndex] = undefined;
        this._startIndex++;
        this._startIndex %= this._data.length;
        return oldHead;
    }
    length(): number {
        let k = this._lastIndexExclusive;
        if (k < this._startIndex) k += this._data.length;
        return k - this._startIndex;
    }
    _resize(minimumCapacity: number) {
        const newCapacity = max(this._data.length * 2, minimumCapacity);
        const newData = new Array(newCapacity);
        const len = this.length();
        for (let i = 0; i < len; i++) {
            newData[i] = this.get(i);
        }
        this._data = newData;
        this._startIndex = 0;
        this._lastIndexExclusive = len;
    }
}
