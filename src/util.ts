const { min, max } = Math;

export const clamp = (x: number, a: number, b: number): number => max(a, min(b, x));
