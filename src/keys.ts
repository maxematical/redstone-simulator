// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code

// A list of all the keys we should track. If a key isn't in this list, it won't be tracked
const trackKeys = [];

// Letter keys
for (let keycode = 0x41; keycode <= 0x5A; keycode++)
    trackKeys.push('Key' + String.fromCharCode(keycode));

// Space keys
trackKeys.push('Space');

// Arrow keys
['Up', 'Down', 'Left', 'Right'].forEach(k => trackKeys.push('Arrow' + k));

// Number keys
for (let i = 0; i <= 9; i++) trackKeys.push('Digit' + i);

// Shift key
trackKeys.push('ShiftLeft');

export default trackKeys;
