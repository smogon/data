import { GenerationNumber } from './gens';

////////////////////////////////////////////////////////////////////////////////

// An override field is just something that is 'present', this replaces that
// field with `T` if 'present' or nothing
type OverrideField<R, Field extends string, T> = R extends Record<Field, 'present'>
  ? Record<Field, T>
  : {};

export type ExtSpec = {
  gens?: {
    [k: string]: unknown;
  };
  species?: {
    prevo?: 'present';
    evos?: 'present';
    [k: string]: unknown;
  };
};

// Array may be empty if no fields.
export type ExtField<Ext extends ExtSpec, Field extends string> = Ext extends Record<Field, unknown>
  ? Ext[Field]
  : {};

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

export type Generation<K extends Format, Ext extends ExtSpec = {}> = ExtField<Ext, 'gens'> & {
  species: Collection<K, Species<K, Ext>>;
};

export type GameObject<K extends Format, Ext extends ExtSpec = {}> = Backref<
  K,
  'gen',
  Generation<K, Ext>
>;

export type Species<K extends Format, Ext extends ExtSpec = {}> = Omit<
  ExtField<Ext, 'species'>,
  'prevo' | 'evos'
> &
  GameObject<K, Ext> &
  // Inline calls to OverrideField to get this to work
  (ExtField<Ext, 'species'> extends { prevo: 'present' }
    ? { prevo: Ref<K, Species<K, Ext>> | null }
    : {}) &
  (ExtField<Ext, 'species'> extends { evos: 'present' }
    ? { evos: Array<Ref<K, Species<K, Ext>>> }
    : {});
