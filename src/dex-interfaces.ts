import { GenerationNumber } from './gens';

export interface Store<T> {
  [Symbol.iterator](): Iterator<T>;
}

type Format = 'Plain' | 'Rich';

type Ref<K extends Format, T> = { Plain: number; Rich: T }[K];
// Can't use { Plain: undefined, Rich: T }, because that requires the key be present in the record. Instead, intersect this record.
type Backref<K extends Format, Prop extends string, T> = {
  Plain: {};
  Rich: Record<Prop, T>;
}[K];
type Collection<K extends Format, T> = { Plain: T[]; Rich: Store<T> }[K];

export interface Dex<K extends Format> {
  gens: Collection<K, Generation<K>>;
}

export interface Generation<K extends Format> {
  num: GenerationNumber;
  species: Collection<K, Species<K>>;
}

export type GameObject<K extends Format> = { name: string } & Backref<K, 'gen', Generation<K>>;

export type Species<K extends Format> = {
  prevo: Ref<K, Species<K>> | null;
  evos: Array<Ref<K, Species<K>>>;
} & GameObject<K>;
