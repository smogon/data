import { GenerationNumber } from './gens';

////////////////////////////////////////////////////////////////////////////////

export type ExtSpec = {
  gens?: {
    [k: string]: unknown;
  };
  species?: {
    prevo?: 'present';
    evos?: 'present';
    abilities?: 'present';
    types?: 'present';
    [k: string]: unknown;
  };
  abilities?: {
    [k: string]: unknown;
  };
  items?: {
    [k: string]: unknown;
  };
  moves?: {
    [k: string]: unknown;
  };
  types?: {
    [k: string]: unknown;
  };
};

// Array may be empty if no fields.
export type ExtField<Ext extends ExtSpec, Field extends string> = Ext extends Record<Field, unknown>
  ? Ext[Field]
  : {};

export type RichField<
  Ext extends ExtSpec,
  Field extends string,
  R extends Record<string, unknown>
> = ExtField<Ext, Field> extends Record<keyof R, 'present'> ? R : {};

////////////////////////////////////////////////////////////////////////////////

export interface Store<T> {
  [Symbol.iterator](): Iterator<T>;
}

type Format = 'Plain' | 'Rich';

type Ref<K extends Format, T> = { Plain: number; Rich: T }[K];
// Can't use { Plain: undefined, Rich: T }, because that requires the key be present in the record. Instead, intersect this record.
type Backref<K extends Format, Field extends string, T> = {
  Plain: {};
  Rich: Record<Field, T>;
}[K];
type Collection<K extends Format, T> = { Plain: T[]; Rich: Store<T> }[K];

export interface Dex<K extends Format, Ext extends ExtSpec = {}> {
  gens: Collection<K, Generation<K, Ext>>;
}

export type Generation<K extends Format, Ext extends ExtSpec = {}> = Omit<
  ExtField<Ext, 'gens'>,
  'species' | 'abilities' | 'items' | 'moves' | 'types'
> &
  // Inline call to OverrideField ;
  RichField<Ext, 'gens', { species: Collection<K, Species<K, Ext>> }> &
  RichField<Ext, 'gens', { abilities: Collection<K, Ability<K, Ext>> }> &
  RichField<Ext, 'gens', { items: Collection<K, Item<K, Ext>> }> &
  RichField<Ext, 'gens', { moves: Collection<K, Move<K, Ext>> }> &
  RichField<Ext, 'gens', { types: Collection<K, Type<K, Ext>> }>;

export type GameObject<K extends Format, Ext extends ExtSpec = {}> = Backref<
  K,
  'gen',
  Generation<K, Ext>
>;

export type Species<K extends Format, Ext extends ExtSpec = {}> = Omit<
  ExtField<Ext, 'species'>,
  'prevo' | 'evos' | 'abilities' | 'types'
> &
  GameObject<K, Ext> &
  RichField<Ext, 'species', { prevo: Ref<K, Species<K, Ext>> | null }> &
  RichField<Ext, 'species', { evos: Array<Ref<K, Species<K, Ext>>> }> &
  RichField<Ext, 'species', { abilities: Array<Ref<K, Ability<K, Ext>>> }> &
  RichField<Ext, 'species', { types: Array<Ref<K, Type<K, Ext>>> }>;

export type Ability<K extends Format, Ext extends ExtSpec = {}> = ExtField<Ext, 'abilities'> &
  GameObject<K, Ext>;

export type Item<K extends Format, Ext extends ExtSpec = {}> = ExtField<Ext, 'items'> &
  GameObject<K, Ext>;

export type Move<K extends Format, Ext extends ExtSpec = {}> = ExtField<Ext, 'moves'> &
  GameObject<K, Ext>;

export type Type<K extends Format, Ext extends ExtSpec = {}> = ExtField<Ext, 'types'> &
  GameObject<K, Ext>;
