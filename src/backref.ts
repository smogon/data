import { ExtSpec, ExtField, Dex, Format, Present } from './dex-interfaces';
import * as Impl from './dex-lazy-impl';

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

export function constructBackref<
  K extends Format,
  Ext extends ExtSpec,
  FirstOuter extends string,
  FirstInner extends string,
  FirstKey extends string | undefined = undefined,
  FirstMultiple extends boolean | undefined = undefined,
  SecondOuter extends string = string,
  SecondInner extends string = string,
  SecondKey extends string | undefined = undefined,
  SecondMultiple extends boolean | undefined = undefined
>(
  dex: Dex<
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
): Dex<
  K,
  Ext &
    Record<FirstOuter, Record<FirstInner, Present>> &
    Record<SecondOuter, Record<SecondInner, Present>>
> {
  generateBackrefs(dex as any, first as any, second as any);
  return dex as any;
}

function backrefIsLeftToRight(dex: Impl.Dex, outer: string, inner: string) {
  // ASSUMPTION: our sources will always contain at least one non-null delta
  for (const gen of dex.gens) {
    const genOuter = gen[outer] as Impl.Transformer<any, Impl.GenerationalBase>;
    for (const [sources] of genOuter.sourcesById()) {
      for (const source of sources) {
        if (source !== undefined && source !== null && inner in source) {
          return false;
        }
      }
    }
    break;
  }

  return true;
}

function generateBackrefs(dex: Impl.Dex, first: BackrefInformation, second: BackrefInformation) {
  // Swap first and second if needed so that backref is always
  // first (exists) -> second (construct)
  if (!backrefIsLeftToRight(dex, second.path[0], second.path[1])) {
    [first, second] = [second, first];
  }

  const [firstOuter, firstInner, firstKey] = first.path;
  const [secondOuter, secondInner, secondKey] = second.path;

  // Perform backref
  for (const gen of dex.gens) {
    // Map second -> first
    const results = getGenerationBackrefData(gen, firstOuter, firstInner, firstKey, secondKey);

    // Add to second sources
    const transformer = gen[secondOuter] as Impl.Transformer<any, Impl.GenerationalBase>;
    transformer.mapSource(
      (data, id) => {
        const backrefData = second.multiple !== false ? results[id] : results[id][0];
        // Add to internal-use source
        data[0][secondInner] = backrefData;
      },
      (obj, id) => {
        const sym = (obj.constructor as typeof Impl.GenerationalBase).REMAP[secondInner];
        (obj as any)[sym ?? secondInner] = results[id];
      }
    );
  }
}

function getGenerationBackrefData(
  gen: Impl.Generation,
  firstOuter: string,
  firstInner: string,
  firstKey?: string,
  secondKey?: string
) {
  const createObj = (from: Record<string, any>, newId: number) => {
    if (secondKey === undefined) return newId;
    if (firstKey === undefined) return { [secondKey]: newId };

    const obj = Object.assign({}, from);
    delete obj[firstKey];
    obj[secondKey] = newId;
    return obj;
  };

  const results: Record<number, Array<number | Record<string, number>>> = {};
  const addToResults = (key: number, data: number | Record<string, number>) => {
    if (!(key in results)) results[key] = [];
    results[key].push(data);
  };

  const transformer = gen[firstOuter] as Impl.Transformer<any, Impl.GenerationalBase>;
  let sourceIdx: number | undefined;

  for (const [source, id] of transformer.sourcesById()) {
    if (sourceIdx === undefined) {
      // Find what source `firstInner` is in
      let found = false;
      for (let i = 0, len = source.length; i < len; i++) {
        if (source[i] !== undefined && source[i] !== null) {
          found = true;

          if (firstInner in source[i]) {
            sourceIdx = i;
            break;
          }
        }
      }
      if (!found) continue;

      if (sourceIdx === undefined) {
        throw new Error(`could not find ${firstOuter}.${firstInner} in any source to backref`);
      }
    }

    const src = source[sourceIdx];
    if (src === undefined || src === null) continue;

    const backref = src[firstInner];
    if (Array.isArray(backref)) {
      for (const item of backref) {
        if (firstKey === undefined) {
          addToResults(item, createObj(item, id));
        } else {
          addToResults(item[firstKey], createObj(item, id));
        }
      }
    } else {
      if (firstKey === undefined) {
        addToResults(backref, createObj(backref, id));
      } else {
        addToResults(backref[firstKey], createObj(backref, id));
      }
    }
  }

  return results;
}
