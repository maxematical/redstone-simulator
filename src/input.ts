import trackKeys from './keys';

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
