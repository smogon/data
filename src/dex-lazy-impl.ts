// If all sources for an id are null, then it isn't a member of this
// generation. If one source has null and another has a record, then the null
// contributes nothing.
//
// TODO: allow an object ("sparse") representation
//
// TODO: support generational deltas, but need a mask of which objects are in
// the generation
type Delta<T> = Array<T | null>;

class Transformer<Src, Dest> {
  constructor(
    private source: Array<Delta<Src>>,
    private fn: (dv: Delta<Src>) => Dest,
    private cache: Dest[] = []
  ) {}

  get(id: number) {
    let v = this.cache[id];
    if (v !== undefined) {
      return v;
    }

    // TODO: don't allocate here; rely on this.fn rejecting if no sources?
    const sources = [];
    for (const source of this.source) {
      const dv = source[id];
      if (dv === undefined || dv === null) {
        continue;
      }
      sources.push(dv);
    }

    if (sources.length === 0) {
      return undefined;
    }

    v = this.fn(sources);
    this.cache[id] = v;
    return v;
  }

  resolve(id: number) {
    const v = this.get(id);
    if (v === undefined) throw new Error(`Cannot resolve ${id}`);
    return v;
  }

  find(fn: (obj: Dest) => boolean) {
    for (const obj of this) {
      if (fn(obj)) {
        return obj;
      }
    }
    return undefined;
  }

  find1(fn: (obj: Dest) => boolean) {
    const v = this.find(fn);
    if (v === undefined) {
      throw new Error('Nothing found');
    }
    return v;
  }

  *[Symbol.iterator]() {
    // TODO: more efficient hole skipping
    let length = 0;
    for (const source of this.source) {
      length = Math.max(length, source.length);
    }

    for (let i = 0; i < length; i++) {
      const v = this.get(i);
      if (v === undefined) continue;
      yield v;
    }
  }
}

function assignRemap(
  remap: Record<string, symbol>,
  dest: any,
  srcs: Delta<Record<string, unknown>>
) {
  for (const src of srcs) {
    // src can be null, reminder that for-in on null is a no-op
    for (const k in src) {
      if (k in remap) {
        dest[remap[k]] = src[k];
      } else {
        dest[k] = src[k];
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

export default class Dex {
  gens: Transformer<any, any>;
  constructor(dexSrc: any[]) {
    const genSrc: any[] = [];
    this.gens = new Transformer(genSrc, (gen: any[]) => new Generation(gen));
    for (const dex of dexSrc) {
      genSrc.push(dex.gens);
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

class Generation {
  species: Transformer<any, any>;
  abilities: Transformer<any, any>;
  items: Transformer<any, any>;
  moves: Transformer<any, any>;
  types: Transformer<any, any>;
  [k: string]: unknown;

  constructor(genSrc: any[]) {
    // Explicitly relying on the ability to mutate this before accessing a
    // transformer element
    const speciesSrc: any[] = [];
    const abilitiesSrc: any[] = [];
    const itemsSrc: any[] = [];
    const movesSrc: any[] = [];
    const typesSrc: any[] = [];

    this.species = new Transformer(speciesSrc, (specie: any[]) => new Species(this, specie));
    this.abilities = new Transformer(abilitiesSrc, (ability: any[]) => new Ability(this, ability));
    this.items = new Transformer(itemsSrc, (item: any[]) => new Item(this, item));
    this.moves = new Transformer(movesSrc, (move: any[]) => new Move(this, move));
    this.types = new Transformer(typesSrc, (type: any[]) => new Type(this, type));

    // Can we abstract this logic into assignRemap?
    for (const gen of genSrc) {
      for (const k in gen) {
        switch (k) {
          case 'species':
            speciesSrc.push(gen[k]);
            break;
          case 'abilities':
            abilitiesSrc.push(gen[k]);
            break;
          case 'items':
            itemsSrc.push(gen[k]);
            break;
          case 'moves':
            movesSrc.push(gen[k]);
            break;
          case 'types':
            typesSrc.push(gen[k]);
            break;
          default:
            this[k] = gen[k];
            break;
        }
      }
    }
  }
}

class GenerationalBase {
  constructor(public gen: Generation) {}
}

////////////////////////////////////////////////////////////////////////////////

const prevoSym = Symbol();
const evosSym = Symbol();
const abilitiesSym = Symbol();
const typesSym = Symbol();
const learnsetSym = Symbol();
const altBattleFormesSym = Symbol();

class SpeciesBase extends GenerationalBase {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  private [abilitiesSym]: number[] | undefined;
  private [typesSym]: number[] | undefined;
  private [learnsetSym]: number[] | undefined;
  private [altBattleFormesSym]: number[] | undefined;

  get prevo() {
    const v = this[prevoSym];
    if (v === undefined) throw new Error('prevo not loaded yet');
    if (v === null) return null;
    return this.gen.species.resolve(v);
  }

  get evos() {
    const v = this[evosSym];
    if (v === undefined) throw new Error('evos not loaded yet');
    return v.map(id => this.gen.species.resolve(id));
  }

  get abilities() {
    const v = this[abilitiesSym];
    if (v === undefined) throw new Error('abilities not loaded yet');
    return v.map(id => this.gen.abilities.resolve(id));
  }

  get types() {
    const v = this[typesSym];
    if (v === undefined) throw new Error('types not loaded yet');
    return v.map(id => this.gen.types.resolve(id));
  }

  get learnset() {
    const v = this[learnsetSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    return v.map(id => this.gen.moves.resolve(id));
  }

  get altBattleFormes() {
    const v = this[altBattleFormesSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    return v.map(id => this.gen.species.resolve(id));
  }
}

class Species extends SpeciesBase {
  [k: string]: unknown;

  constructor(gen: Generation, specie: any[]) {
    super(gen);
    assignRemap(
      {
        prevo: prevoSym,
        evos: evosSym,
        abilities: abilitiesSym,
        types: typesSym,
        learnset: learnsetSym,
        altBattleFormes: altBattleFormesSym,
      },
      this,
      specie
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

class Ability extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, ability: any[]) {
    super(gen);
    assignRemap({}, this, ability);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Item extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, item: any[]) {
    super(gen);
    assignRemap({}, this, item);
  }
}

////////////////////////////////////////////////////////////////////////////////

const typeSym = Symbol();

class MoveBase extends GenerationalBase {
  private [typeSym]: number | undefined;

  get type() {
    const v = this[typeSym];
    if (v === undefined) throw new Error('type not loaded yet');
    return this.gen.types.resolve(v);
  }
}

class Move extends MoveBase {
  [k: string]: unknown;

  constructor(gen: Generation, move: any) {
    super(gen);
    assignRemap({ type: typeSym }, this, move);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Type extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, type: any) {
    super(gen);
    assignRemap({}, this, type);
  }
}
