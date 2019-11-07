class Transformer<Src, Dest> {
  constructor(
    private source: Src[],
    private fn: (dv: Src) => Dest,
    private cache: Dest[] = new Array(source.length)
  ) {}

  get(id: number) {
    let v = this.cache[id];
    if (v !== undefined) {
      return v;
    }

    const dv = this.source[id];
    if (dv === undefined) {
      throw new Error(`Cannot resolve ${id}`);
    }

    v = this.fn(dv);
    this.cache[id] = v;
    return v;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.source.length; i++) {
      yield this.get(i);
    }
  }
}

function assignRemap(remap: Record<string, symbol>, dest: any, src: any) {
  for (const k in src) {
    if (k in remap) {
      dest[remap[k]] = src[k];
    } else {
      dest[k] = src[k];
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

export default class Dex {
  constructor(
    dex: any,
    public gens = new Transformer(dex.gens, (gen: any) => new Generation(gen))
  ) {}
}

////////////////////////////////////////////////////////////////////////////////

class Generation {
  [k: string]: unknown;

  constructor(
    gen: any,
    // Must always be defined for now; decide what to do later
    public species: Transformer<any, any> = new Transformer(
      gen.species !== undefined ? gen.species : [],
      (specie: any) => new Species(this, specie)
    ),
    public abilities: Transformer<any, any> = new Transformer(
      gen.abilities !== undefined ? gen.abilities : [],
      (ability: any) => new Ability(this, ability)
    ),
    public items: Transformer<any, any> = new Transformer(
      gen.items !== undefined ? gen.items : [],
      (item: any) => new Item(this, item)
    ),
    public moves: Transformer<any, any> = new Transformer(
      gen.moves !== undefined ? gen.moves : [],
      (move: any) => new Move(this, move)
    ),
    public types: Transformer<any, any> = new Transformer(
      gen.types !== undefined ? gen.types : [],
      (type: any) => new Type(this, type)
    )
  ) {
    for (const k in gen) {
      switch (k) {
        case 'species':
        case 'abilities':
        case 'items':
        case 'moves':
        case 'types':
          break;
        default:
          this[k] = gen[k];
          break;
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

class SpeciesBase extends GenerationalBase {
  private [prevoSym]: number | null | undefined;
  private [evosSym]: number[] | undefined;
  private [abilitiesSym]: number[] | undefined;
  private [typesSym]: number[] | undefined;
  private [learnsetSym]: number[] | undefined;

  get prevo() {
    const v = this[prevoSym];
    if (v === undefined) throw new Error('prevo not loaded yet');
    if (v === null) return null;
    return this.gen.species.get(v);
  }

  get evos() {
    const v = this[evosSym];
    if (v === undefined) throw new Error('evos not loaded yet');
    return v.map(id => this.gen.species.get(id));
  }

  get abilities() {
    const v = this[abilitiesSym];
    if (v === undefined) throw new Error('abilities not loaded yet');
    return v.map(id => this.gen.abilities.get(id));
  }

  get types() {
    const v = this[typesSym];
    if (v === undefined) throw new Error('types not loaded yet');
    return v.map(id => this.gen.types.get(id));
  }

  get learnset() {
    const v = this[learnsetSym];
    if (v === undefined) throw new Error('learnset not loaded yet');
    return v.map(id => this.gen.moves.get(id));
  }
}

class Species extends SpeciesBase {
  [k: string]: unknown;

  constructor(gen: Generation, specie: any) {
    super(gen);
    assignRemap(
      {
        prevo: prevoSym,
        evos: evosSym,
        abilities: abilitiesSym,
        types: typesSym,
        learnset: learnsetSym,
      },
      this,
      specie
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

class Ability extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, ability: any) {
    super(gen);
    assignRemap({}, this, ability);
  }
}

////////////////////////////////////////////////////////////////////////////////

class Item extends GenerationalBase {
  [k: string]: unknown;

  constructor(gen: Generation, item: any) {
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
    return this.gen.types.get(v);
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
