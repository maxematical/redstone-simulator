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
        const internalIndex = (index + this._startIndex) % this._data.length;
        this._data[internalIndex] = value;
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

interface LinkedListNode<T> {
    value: T;
    prev: LinkedListNode<T>;
    next: LinkedListNode<T>;
    special?: string;
}

export interface Iterator<T> {
    next(): T;
    hasNext(): boolean;
    remove(): void;
}

class LinkedListIterator<T> implements Iterator<T> {
    node: LinkedListNode<T>;
    readonly onRemove: () => void;
    constructor(onRemove: () => void) {
        this.node = null;
        this.onRemove = onRemove;
    }
    _setup(head: LinkedListNode<T>) {
        this.node = head;
    }
    next(): T {
        if (this.node.next.special) throw new Error('Reached end of list');
        this.node = this.node.next;
        return this.node.value;
    }
    hasNext(): boolean {
        return !(this.node.next.special);
    }
    remove() {
        if (this.node.special) throw new Error('To remove a node, call next(), then remove() will remove that node');
        const prev = this.node.prev;
        const next = this.node.next;
        prev.next = next;
        next.prev = prev;
        this.onRemove();
    }
}

export class LinkedList<T> {
    _length: number;
    readonly head: LinkedListNode<T>;
    readonly tail: LinkedListNode<T>;
    it: LinkedListIterator<T>;
    constructor() {
        this._length = 0;
        this.head = { value: null, prev: null, next: null, special: 'head' };
        this.tail = { value: null, prev: null, next: null, special: 'tail' };
        this.head.next = this.tail;
        this.tail.prev = this.head;
        this.it = new LinkedListIterator(() => this._length--);
    }
    get(i: number): T {
        this._indexCheck(i);
        let node = this.head;
        for (let j = 0; j <= i; j++) {
            node = node.next;
        }
        return node.value;
    }
    set(i: number, value: T): void {
        this._indexCheck(i);
        let node = this.head;
        for (let j = 0; j <= i; j++) {
            node = node.next;
        }
        node.value = value;
    }
    push(value: T): void {
        const newNode: LinkedListNode<T> = { value, prev: this.tail.prev, next: this.tail };
        this.tail.prev.next = newNode;
        this.tail.prev = newNode;
        this._length++;
    }
    remove(value: T): boolean {
        const iterator = this.iterator();
        while (iterator.hasNext()) {
            if (iterator.next() === value) {
                iterator.remove();
                return true;
            }
        }
        return false;
    }
    iterator(): Iterator<T> {
        this.it._setup(this.head);
        return this.it;
    }
    length(): number {
        return this._length;
    }
    _indexCheck(i: number) {
        if (i < 0 || i >= this._length)
            throw new Error(`Index out of bounds: ${i}`);
    }
}
