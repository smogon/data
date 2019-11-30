import { GenerationNumber } from './gens';

////////////////////////////////////////////////////////////////////////////////

export type Present = 'present';

// TypeScript just gives up at inferring an ExtSpec. If we leave just the rich fields ('present') then an extension without any rich fields will trigger "weak type detection" (https://mariusschulz.com/blog/weak-type-detection-in-typescript). But if we leave the [k: string]: unknown bits, then leaving out a type annotation means all fields are present.
//
// So for now, just deal with errors where you put something other than
// 'present'. Or maybe there's another way. idk.
export type ExtSpec = {
  gens?: {
    //[k: string]: unknown;
  };
  species?: {
    //prevo?: Present;
    //evos?: Present;
    //abilities?: Present;
    //types?: Present;
    //learnset?: Present;
    //[k: string]: unknown;
  };
  abilities?: {
    //[k: string]: unknown;
  };
  items?: {
    //[k: string]: unknown;
  };
  moves?: {
    //type?: Present;
  };
  types?: {
    //[k: string]: unknown;
  };
};

// Array may be empty if no fields.
type ExtField<Ext, Field extends string> = Ext extends Record<Field, unknown> ? Ext[Field] : {};

type RichField<
  Ext extends ExtSpec,
  Field extends string,
  R extends Record<string, unknown>
> = ExtField<Ext, Field> extends Record<keyof R, Present> ? R : {};

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
type IfRich<K extends Format, T extends Record<string, unknown>> = {
  Plain: {};
  Rich: T;
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

type BackrefUndefined = 'UNDEFINED';
type BackrefTrue = 'TRUE';
type BackrefFalse = 'FALSE';

type CanBackref<
  Ext extends ExtSpec,
  FirstOuter extends string,
  FirstInner extends string,
  SecondOuter extends string = FirstInner,
  SecondInner extends string = FirstOuter
> = ExtField<ExtField<Ext, FirstOuter>, FirstInner> extends Record<string, never>
  ? ExtField<ExtField<Ext, SecondOuter>, SecondInner> extends Record<string, never>
    ? never
    : Record<FirstOuter, Partial<Record<FirstInner, undefined>>>
  : Record<SecondOuter, Partial<Record<SecondInner, undefined>>>;

type BackreffableEntry<
  FirstOuter extends string,
  FirstInner extends string,
  FirstKey extends string | undefined,
  FirstMultiple extends boolean | undefined,
  SecondOuter extends string,
  SecondInner extends string,
  SecondKey extends string | undefined,
  SecondMultiple extends boolean | undefined
> = Record<
  FirstOuter,
  Record<
    FirstInner,
    Record<
      FirstKey extends undefined ? BackrefUndefined : FirstKey,
      Record<
        FirstMultiple extends undefined
          ? BackrefUndefined | BackrefTrue
          : FirstMultiple extends true
          ? BackrefTrue | BackrefUndefined
          : BackrefFalse,
        Record<
          SecondOuter,
          Record<
            SecondInner,
            Record<
              SecondKey extends undefined ? BackrefUndefined : SecondKey,
              Record<
                SecondMultiple extends undefined
                  ? BackrefUndefined | BackrefTrue
                  : SecondMultiple extends true
                  ? BackrefTrue | BackrefUndefined
                  : BackrefFalse,
                any
              >
            >
          >
        >
      >
    >
  >
> &
  Record<
    SecondOuter,
    Record<
      SecondInner,
      Record<
        SecondKey extends undefined ? BackrefUndefined : SecondKey,
        Record<
          SecondMultiple extends undefined
            ? BackrefUndefined | BackrefTrue
            : SecondMultiple extends true
            ? BackrefTrue | BackrefUndefined
            : BackrefFalse,
          Record<
            FirstOuter,
            Record<
              FirstInner,
              Record<
                FirstKey extends undefined ? BackrefUndefined : FirstKey,
                Record<
                  FirstMultiple extends undefined
                    ? BackrefUndefined | BackrefTrue
                    : FirstMultiple extends true
                    ? BackrefTrue | BackrefUndefined
                    : BackrefFalse,
                  any
                >
              >
            >
          >
        >
      >
    >
  >;

type Backreffables = BackreffableEntry<
  'types',
  'species',
  undefined,
  true,
  'species',
  'types',
  undefined,
  true
> &
  BackreffableEntry<'species', 'learnset', 'what', true, 'moves', 'species', 'what', true> &
  BackreffableEntry<'moves', 'type', undefined, false, 'types', 'moves', undefined, true>;

type Backreffable<
  FirstOuter extends string,
  FirstInner extends string,
  FirstKey extends string | undefined,
  FirstMultiple extends boolean | undefined,
  SecondOuter extends string,
  SecondInner extends string,
  SecondKey extends string | undefined,
  SecondMultiple extends boolean | undefined
> = ExtField<
  ExtField<
    ExtField<
      ExtField<
        ExtField<
          ExtField<
            ExtField<ExtField<Backreffables, FirstOuter>, FirstInner>,
            FirstKey extends undefined ? BackrefUndefined : FirstKey
          >,
          FirstMultiple extends undefined
            ? BackrefUndefined
            : FirstMultiple extends true
            ? BackrefTrue
            : BackrefFalse
        >,
        SecondOuter
      >,
      SecondInner
    >,
    SecondKey extends undefined ? BackrefUndefined : SecondKey
  >,
  SecondMultiple extends undefined
    ? BackrefUndefined
    : SecondMultiple extends true
    ? BackrefTrue
    : BackrefFalse
> extends Record<string, never>
  ? never
  : {};

export type BackrefInformation<
  Outer extends string = string,
  Inner extends string = string,
  Key extends string | undefined = undefined,
  Multiple extends boolean | undefined = undefined
> = {
  path: [Outer, Inner] | [Outer, Inner, Key];
  multiple?: Multiple;
};

export type Dex<K extends Format, Ext extends ExtSpec = {}> = {
  gens: Collection<K, Generation<K, Ext>>;
} & IfRich<
  K,
  {
    constructBackref: <
      FirstOuter extends string,
      FirstInner extends string,
      FirstKey extends string | undefined = undefined,
      FirstMultiple extends boolean | undefined = undefined,
      SecondOuter extends string = string,
      SecondInner extends string = string,
      SecondKey extends string | undefined = undefined,
      SecondMultiple extends boolean | undefined = undefined
    >(
      this: Dex<
        K,
        Ext &
          Backreffable<
            FirstOuter,
            FirstInner,
            FirstKey,
            FirstMultiple,
            SecondOuter,
            SecondInner,
            SecondKey,
            SecondMultiple
          > &
          CanBackref<Ext, FirstOuter, FirstInner, SecondOuter, SecondInner>
      >,
      first: BackrefInformation<FirstOuter, FirstInner, FirstKey, FirstMultiple>,
      second: BackrefInformation<SecondOuter, SecondInner, SecondKey, SecondMultiple>
    ) => Dex<
      K,
      Ext &
        Record<FirstOuter, Record<FirstInner, Present>> &
        Record<SecondOuter, Record<SecondInner, Present>>
    >;
    species: Store<GenFamily<Species<K, Ext>>>;
    abilities: Store<GenFamily<Ability<K, Ext>>>;
    items: Store<GenFamily<Item<K, Ext>>>;
    moves: Store<GenFamily<Move<K, Ext>>>;
    types: Store<GenFamily<Type<K, Ext>>>;
  }
>;

export type Generation<K extends Format, Ext extends ExtSpec = {}> = Omit<
  ExtField<Ext, 'gens'>,
  'species' | 'abilities' | 'items' | 'moves' | 'types' | 'dex'
> &
  IfRich<K, { dex: Dex<K, Ext> }> &
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
  IfRich<K, { gen: Generation<K, Ext>; genFamily: GenFamily<Me['me']> }>;

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
