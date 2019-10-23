import { ID } from '../common';
import { GenerationNumber } from '../gens';
import { Natures } from '../natures';
import { Stats, StatsTable } from '../stats';

describe('Stats', () => {
  test('calc', () => {
    const rby: StatsTable = { hp: 403, atk: 298, def: 298, spa: 298, spd: 298, spe: 298 };
    const adv: StatsTable = { hp: 404, atk: 328, def: 299, spa: 269, spd: 299, spe: 299 };

    for (let gen = 1; gen <= 7; gen++) {
      for (const stat of Stats) {
        const s = Stats.calc(
          stat,
          100,
          31,
          252,
          100,
          Natures.get('adamant' as ID)!,
          gen as GenerationNumber
        );
        if (gen < 3) {
          expect(s).toBe(rby[stat]);
        } else {
          expect(s).toBe(adv[stat]);
        }
      }
    }

    // Shedinja
    expect(Stats.calc('hp', 1, 31, 252, 100, Natures.get('jolly' as ID)!, 5)).toBe(1);
    // no nature
    expect(Stats.calc('atk', 100, 31, 252, 100)).toBe(299);
  });

  test('get', () => {
    expect(Stats.get('foo')).not.toBeDefined();
    expect(Stats.get('Atk')).toBe('atk');
    expect(Stats.get('Spc')).toBe('spa');
    expect(Stats.get('SpDef')).toBe('spd');
    expect(Stats.get('SAtk')).toBe('spa');
  });

  test('display', () => {
    expect(Stats.display('foo')).toBe('foo');
    expect(Stats.display('Atk')).toBe('Atk');
    expect(Stats.display('Spc')).toBe('SpA');
    expect(Stats.display('SpDef')).toBe('SpD');
    expect(Stats.display('SAtk', true, 7)).toBe('Special Attack');
    expect(Stats.display('SAtk', true, 1)).toBe('Special');
  });

  test('fill', () => {
    expect(Stats.fill({ atk: 10, def: 12, spd: 15 }, 31)).toEqual({
      hp: 31,
      atk: 10,
      def: 12,
      spe: 31,
      spa: 31,
      spd: 15,
    });
    expect(Stats.fill({ spa: 200, spe: 252 }, 0)).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      spe: 252,
      spa: 200,
      spd: 0,
    });
  });

  test('getHPDV', () => {
    expect(Stats.getHPDV({ spa: Stats.dtoi(15), spe: Stats.dtoi(15) })).toBe(15);
    expect(
      Stats.getHPDV({
        atk: Stats.dtoi(5),
        def: Stats.dtoi(15),
        spa: Stats.dtoi(13),
        spe: Stats.dtoi(13),
      })
    ).toBe(15);
    expect(
      Stats.getHPDV({
        def: Stats.dtoi(3),
        spa: Stats.dtoi(11),
        spe: Stats.dtoi(10),
      })
    ).toBe(13);
  });

  test('iterate', () => {
    expect(Array.from(Stats)).toStrictEqual(['hp', 'atk', 'def', 'spe', 'spa', 'spd']);
  });
});
