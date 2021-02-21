import { MaterialRenderer } from './render';

export const materialRegistry = {
    _registry: {},
    createRenderer: (materialName: string): MaterialRenderer => {
        const createRenderer = materialRegistry._registry[materialName];
        if (!createRenderer) {
            throw new Error(`Tried to create a MaterialRenderer for a nonexistent material '${materialName}'`);
        }
        return createRenderer();
    },
    add: (materialName: string, createRenderer: () => MaterialRenderer): void => {
        if (materialName in materialRegistry._registry) {
            throw new Error(`Material '${materialName}' already registered`);
        }
        materialRegistry._registry[materialName] = createRenderer;
    },
};
