import { GenerationNumber } from './gens';

// Plain interface

export interface PlainDex {
  gens: PlainGeneration[];
}

export interface PlainGeneration {
  num: GenerationNumber;
  species: PlainSpecies[];
}

export interface PlainGameObject {
  name: string;
}

export interface PlainSpecies extends PlainGameObject {
  prevo: number | null;
  evos: number[];
}

// Rich interface

export interface Store<T> {
  [Symbol.iterator](): Iterator<T>;
}

export interface Dex {
  gens: Store<Generation>;
}

export interface Generation {
  num: GenerationNumber;
  species: Store<Species>;
}

export interface GameObject {
  gen: Generation;
  name: string;
}

export interface Species extends GameObject {
  prevo: Species | null;
  evos: Species[];
}
