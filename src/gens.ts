export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type GenerationNumber = typeof GENERATIONS[number];
