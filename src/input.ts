// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code

// A list of all the keys we should track. If a key isn't in this list, it won't be tracked
const trackKeys: string[] = [];

// Letter keys
for (let keycode = 0x41; keycode <= 0x5A; keycode++)
trackKeys.push('Key' + String.fromCharCode(keycode));

// Arrow keys
['Up', 'Down', 'Left', 'Right'].forEach(k => trackKeys.push('Arrow' + k));

// Number keys
for (let i = 0; i <= 9; i++) trackKeys.push('Digit' + i);

// Misc. keys
trackKeys.push('Space');
trackKeys.push('ShiftLeft');
trackKeys.push('ShiftRight');
trackKeys.push('Escape');

// Current state of held keys
const keyPressed = [];
const keyDown = [];
const keyWasPressed = [];

const handleKeydown = (e: KeyboardEvent) => {
    if (trackKeys.indexOf(e.code) >= 0) {
        keyPressed[e.code] = true;
    }
};

const handleKeyup = (e: KeyboardEvent) => {
    if (trackKeys.indexOf(e.code) >= 0) {
        keyPressed[e.code] = false;
    }
};

const init = () => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', handleKeyup);

    for (let i = 0; i < trackKeys.length; i++) {
        keyPressed[trackKeys[i]] = false;
        keyDown[trackKeys[i]] = false;
    }
};

const update = () => {
    for (let i = 0; i < trackKeys.length; i++) {
        const k = trackKeys[i];
        keyDown[k] = keyPressed[k] && !keyWasPressed[k];
        keyWasPressed[trackKeys[i]] = keyPressed[k];
    }
};

const input = { init, update, keyPressed, keyDown };
export default input;
