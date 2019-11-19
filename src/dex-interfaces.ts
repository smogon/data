import { GenerationNumber } from './gens';

////////////////////////////////////////////////////////////////////////////////

// TypeScript just gives up at inferring an ExtSpec. If we leave just the rich fields ('present') then an extension without any rich fields will trigger "weak type detection" (https://mariusschulz.com/blog/weak-type-detection-in-typescript). But if we leave the [k: string]: unknown bits, then leaving out a type annotation means all fields are present.
//
// So for now, just deal with errors where you put something other than
// 'present'. Or maybe there's another way. idk.
export type ExtSpec = {
  gens?: {
    //[k: string]: unknown;
  };
  species?: {
    //prevo?: 'present';
    //evos?: 'present';
    //abilities?: 'present';
    //types?: 'present';
    //learnset?: 'present';
    //[k: string]: unknown;
  };
  abilities?: {
    //[k: string]: unknown;
  };
  items?: {
    //[k: string]: unknown;
  };
  moves?: {
    //type?: 'present';
  };
  types?: {
    //[k: string]: unknown;
  };
};

type MaybeField<T, Field extends string> = T extends Record<Field, unknown> ? T[Field] : {};
type TypeOrElse<T, ElseT> = T extends never ? ElseT : T extends Record<string, never> ? ElseT : T;

// Array may be empty if no fields.
type ExtField<Ext extends ExtSpec, Field extends string> = MaybeField<Ext, Field>;

type RichField<
  Ext extends ExtSpec,
  Field extends string,
  R extends Record<string, unknown>
> = ExtField<Ext, Field> extends Record<keyof R, 'present'> ? R : {};

// TODO better name.
type CollectionField<Ext extends ExtSpec, R extends Record<string, unknown>> = Ext extends Record<
  keyof R,
  unknown
>
  ? R
  : {};

////////////////////////////////////////////////////////////////////////////////

export interface Store<T> {
  [Symbol.iterator](): Iterator<T>;
  find(fn: (obj: T) => boolean): T | undefined;
  find1(fn: (obj: T) => boolean): T;
}

export type Format = 'Plain' | 'Rich';

type Ref<K extends Format, T> = { Plain: number; Rich: T }[K];
// Can't use { Plain: undefined, Rich: T }, because that requires the key be present in the record. Instead, intersect this record.
type Backref<K extends Format, Field extends string, T> = {
  Plain: {};
  Rich: Record<Field, T>;
}[K];
// TODO: move delta here
type Collection<K extends Format, T> = { Plain: Array<T | null>; Rich: Store<T> }[K];

export interface GenFamily<T> extends Store<T> {
  earliest: T;
  latest: T;
}

// TODO: parse PS MoveSources into a legit datatype; see sim/global-types.ts for documentation
export type MoveSource = string;

export type Learnset<T> = Array<{ what: T; how: MoveSource[] }>;

export type Dex<K extends Format, Ext extends ExtSpec = {}> = {
  gens: Collection<K, Generation<K, Ext>>;
} & Backref<
  K,
  'constructBackref',
  <
    FirstOuter extends string,
    FirstInner extends string,
    SecondOuter extends string = FirstInner,
    SecondInner extends string = FirstOuter
  >(
    first: [FirstOuter, FirstInner, string?],
    second?: [SecondOuter, SecondInner, string?]
  ) => Dex<
    'Rich',
    Ext &
      {
        [o in FirstOuter]: {
          [i in FirstInner]: TypeOrElse<
            TypeOrElse<
              MaybeField<MaybeField<Ext, FirstOuter>, FirstInner>,
              MaybeField<MaybeField<Ext, SecondOuter>, SecondInner>
            >,
            never
          >;
        };
      } &
      {
        [i in SecondOuter]: {
          [o in SecondInner]: TypeOrElse<
            TypeOrElse<
              MaybeField<MaybeField<Ext, SecondOuter>, SecondInner>,
              MaybeField<MaybeField<Ext, FirstOuter>, FirstInner>
            >,
            never
          >;
        };
      }
  >
> &
  Backref<K, 'species', Store<GenFamily<Species<K, Ext>>>> & // Cross-generational iterators
  Backref<K, 'abilities', Store<GenFamily<Ability<K, Ext>>>> &
  Backref<K, 'items', Store<GenFamily<Item<K, Ext>>>> &
  Backref<K, 'moves', Store<GenFamily<Move<K, Ext>>>> &
  Backref<K, 'types', Store<GenFamily<Type<K, Ext>>>>;

export type Generation<K extends Format, Ext extends ExtSpec = {}> = Omit<
  ExtField<Ext, 'gens'>,
  'species' | 'abilities' | 'items' | 'moves' | 'types' | 'dex'
> &
  Backref<K, 'dex', Dex<K, Ext>> &
  CollectionField<Ext, { species: Collection<K, Species<K, Ext>> }> &
  CollectionField<Ext, { abilities: Collection<K, Ability<K, Ext>> }> &
  CollectionField<Ext, { items: Collection<K, Item<K, Ext>> }> &
  CollectionField<Ext, { moves: Collection<K, Move<K, Ext>> }> &
  CollectionField<Ext, { types: Collection<K, Type<K, Ext>> }>;

export type GameObject<
  K extends Format,
  // Useless wrapper to fool TypeScript's recursion check
  Me extends { me: unknown },
  Ext extends ExtSpec,
  Field extends string,
  Exclude extends string
> = Omit<ExtField<Ext, Field>, Exclude | 'gen' | 'genFamily'> &
  Backref<K, 'gen', Generation<K, Ext>> &
  Backref<K, 'genFamily', GenFamily<Me['me']>>;

export type Species<K extends Format, Ext extends ExtSpec = {}> = GameObject<
  K,
  { me: Species<K, Ext> },
  Ext,
  'species',
  'prevo' | 'evos' | 'abilities' | 'types' | 'learnset' | 'altBattleFormes'
> &
  RichField<Ext, 'species', { prevo: Ref<K, Species<K, Ext>> | null }> &
  RichField<Ext, 'species', { evos: Array<Ref<K, Species<K, Ext>>> }> &
  RichField<Ext, 'species', { abilities: Array<Ref<K, Ability<K, Ext>>> }> &
  RichField<Ext, 'species', { types: Array<Ref<K, Type<K, Ext>>> }> &
  // TODO: Learnset interface
  RichField<Ext, 'species', { learnset: Learnset<Ref<K, Move<K, Ext>>> }> &
  RichField<Ext, 'species', { altBattleFormes: Array<Ref<K, Species<K, Ext>>> }>;

export type Ability<K extends Format, Ext extends ExtSpec = {}> = GameObject<
  K,
  { me: Ability<K, Ext> },
  Ext,
  'abilities',
  never
>;

export type Item<K extends Format, Ext extends ExtSpec = {}> = GameObject<
  K,
  { me: Item<K, Ext> },
  Ext,
  'items',
  never
>;

export type Move<K extends Format, Ext extends ExtSpec = {}> = GameObject<
  K,
  { me: Move<K, Ext> },
  Ext,
  'moves',
  'type' | 'species'
> &
  RichField<Ext, 'moves', { type: Ref<K, Type<K, Ext>> }> &
  RichField<Ext, 'moves', { species: Learnset<Ref<K, Species<K, Ext>>> }>;

export type Type<K extends Format, Ext extends ExtSpec = {}> = GameObject<
  K,
  { me: Type<K, Ext> },
  Ext,
  'types',
  'species' | 'moves'
> &
  RichField<Ext, 'types', { species: Array<Ref<K, Species<K, Ext>>> }> &
  RichField<Ext, 'types', { moves: Array<Ref<K, Move<K, Ext>>> }>;
