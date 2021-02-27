import { LinkedList, Iterator } from './../src/util';
import test from 'ava';

test('linked list add', t => {
    const ll = new LinkedList<string>();
    const values = ['a', 'b', 'c'];
    t.is(ll.length(), 0);
    ll.push(values[0]);
    ll.push(values[1]);
    t.is(ll.length(), 2);
    ll.push(values[2]);
    t.is(ll.length(), 3);
    for (let i = 0; i < 3; i++) {
        t.is(ll.get(i), values[i]);
    }
});
test('linked list set', t => {
    const ll = new LinkedList<string>();
    ll.push('one');
    ll.push('two');
    ll.set(0, 'oneone');
    t.is(ll.length(), 2);
    t.is(ll.get(0), 'oneone');
    t.is(ll.get(1), 'two');
    ll.push('three');
    ll.push('four');
    ll.set(2, '3');
    t.is(ll.length(), 4);
    t.is(ll.get(2), '3');
    t.is(ll.get(3), 'four');
});
test('linked list iterator', t => {
    const values = ['john', 'jacob', 'jingle', 'heimer', 'schmidt'];
    const ll = new LinkedList<string>();
    for (let i = 0; i < values.length; i++)
        ll.push(values[i]);
    
    const iterator = ll.iterator();
    let index = 0;
    while (iterator.hasNext()) {
        const value = iterator.next();
        const expected = values[index++];
        t.is(value, expected);
    }
});
test('linked list iterator remove', t => {
    const values = ['a', 'b', 'c', 'D', 'e', 'f'];
    const ll = new LinkedList<string>();
    for (let i = 0; i < values.length; i++)
        ll.push(values[i]);
    
    t.is(ll.length(), 6);

    const iterator = ll.iterator();
    while (iterator.hasNext()) {
        const value = iterator.next();
        if (value === 'D') iterator.remove();
    }

    t.is(ll.length(), 5);
    t.is(ll.get(0), values[0]);
    t.is(ll.get(1), values[1]);
    t.is(ll.get(2), values[2]);
    t.is(ll.get(3), values[4]);
    t.is(ll.get(4), values[5]);
});
