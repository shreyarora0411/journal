import { aggregateDishes } from './dish-aggregate';

describe('aggregateDishes', () => {
  it('returns empty for no lovers and no viewer dishes', () => {
    expect(aggregateDishes([])).toEqual([]);
    expect(aggregateDishes([{ dishes: null }, { dishes: [] }], null)).toEqual([]);
  });

  it('ignores blank entries and trims the rest', () => {
    expect(aggregateDishes([{ dishes: ['  ', ''] }], [' raan '])).toEqual(['raan']);
  });

  it('dedups across casing/whitespace and keeps first-seen casing', () => {
    expect(
      aggregateDishes([{ dishes: ['Raan'] }, { dishes: ['  raan '] }, { dishes: ['RAAN'] }]),
    ).toEqual(['Raan']);
  });

  it('orders by mention count desc, counting the viewer as a mention', () => {
    expect(
      aggregateDishes(
        [{ dishes: ['fizz', 'raan'] }, { dishes: ['raan'] }, { dishes: ['dal'] }],
        ['dal', 'raan'],
      ),
    ).toEqual(['raan', 'dal', 'fizz']);
  });

  it('breaks count ties by first-seen order', () => {
    expect(aggregateDishes([{ dishes: ['kokum fizz', 'raan'] }, { dishes: ['dal'] }])).toEqual([
      'kokum fizz',
      'raan',
      'dal',
    ]);
  });

  it('caps the line at 6', () => {
    const lovers = [
      { dishes: ['d1', 'd2', 'd3'] },
      { dishes: ['d4', 'd5', 'd6'] },
      { dishes: ['d7', 'd8'] },
    ];
    expect(aggregateDishes(lovers)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
  });
});
