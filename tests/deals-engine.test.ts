import { describe, expect, it } from 'vitest';
import { filterCars, sortCars } from '../src/lib/deals-engine';
import type { Car } from '../src/types/car';

const baseCar = (overrides: Partial<Car> = {}): Car => ({
  id: overrides.id ?? String(Math.random()),
  price: 100_000,
  brand: 'Toyota',
  model: 'Yaris',
  year: 2020,
  mileage: 50_000,
  ...overrides,
});

const emptyFilters = {
  brandFilter: 'all', modelFilter: 'all', regionFilter: 'all', colorFilter: 'all',
  ownersFilter: 'all', fuelFilter: 'all', gearboxFilter: 'all', sellerTypeFilter: 'all',
  getaroundFilter: false, onlyComplete: false, onlyWithImage: false,
  priceMin: '', priceMax: '', yearMin: '', yearMax: '', kmMin: '', kmMax: '',
  debouncedSearch: '', prefs: {},
};

describe('filterCars', () => {
  it('drops cars with zero/negative price', () => {
    expect(filterCars([baseCar({ price: 0 }), baseCar({ price: 50_000 })], emptyFilters)).toHaveLength(1);
  });

  it('matches brand filter exactly', () => {
    const cars = [baseCar({ brand: 'Toyota' }), baseCar({ brand: 'Volvo' })];
    expect(filterCars(cars, { ...emptyFilters, brandFilter: 'Volvo' })).toHaveLength(1);
  });

  it('applies priceMin/priceMax range', () => {
    const cars = [baseCar({ price: 50_000 }), baseCar({ price: 150_000 }), baseCar({ price: 300_000 })];
    expect(filterCars(cars, { ...emptyFilters, priceMin: '100000', priceMax: '200000' })).toHaveLength(1);
  });

  it('applies search across brand+model case-insensitively', () => {
    const cars = [baseCar({ brand: 'Tesla', model: 'Model 3' }), baseCar({ brand: 'BMW' })];
    expect(filterCars(cars, { ...emptyFilters, debouncedSearch: 'TESLA' })).toHaveLength(1);
    expect(filterCars(cars, { ...emptyFilters, debouncedSearch: 'model 3' })).toHaveLength(1);
  });

  it('getaround filter excludes supercars and >15yo cars and >200k km', () => {
    const cars = [
      baseCar({ id: 'a', brand: 'Toyota', year: 2020, mileage: 100_000 }),
      baseCar({ id: 'b', brand: 'Ferrari', year: 2020, mileage: 50_000 }),
      baseCar({ id: 'c', brand: 'Toyota', year: 2005, mileage: 50_000 }),
      baseCar({ id: 'd', brand: 'Toyota', year: 2020, mileage: 220_000 }),
    ];
    const r = filterCars(cars, { ...emptyFilters, getaroundFilter: true }, 2025);
    expect(r.map((c) => c.id)).toEqual(['a']);
  });

  it('prefs.onlyBelowFair drops cars at/above fair price', () => {
    const cars = [
      baseCar({ id: 'below', price: 90_000, fairPrice: 100_000 }),
      baseCar({ id: 'at', price: 100_000, fairPrice: 100_000 }),
      baseCar({ id: 'no-fair', price: 50_000 }),
    ];
    const r = filterCars(cars, { ...emptyFilters, prefs: { onlyBelowFair: true } });
    expect(r.map((c) => c.id)).toEqual(['below']);
  });
});

describe('sortCars', () => {
  it('savingKr sorts by server-computed savingKr descending', () => {
    const cars = [
      baseCar({ id: 'a', savingKr: 5_000 }),
      baseCar({ id: 'b', savingKr: 20_000 }),
      baseCar({ id: 'c', savingKr: -1_000 }),
    ];
    expect(sortCars(cars, 'savingKr').map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('falls back to fairPrice-price when savingKr missing', () => {
    const cars = [
      baseCar({ id: 'a', price: 80_000, fairPrice: 100_000 }), // saving = 20k
      baseCar({ id: 'b', price: 95_000, fairPrice: 100_000 }), // saving = 5k
    ];
    expect(sortCars(cars, 'savingKr')[0].id).toBe('a');
  });

  it('priceAsc returns cheapest first', () => {
    const cars = [baseCar({ id: 'a', price: 200_000 }), baseCar({ id: 'b', price: 50_000 })];
    expect(sortCars(cars, 'priceAsc')[0].id).toBe('b');
  });

  it('dealScore prefers higher score', () => {
    const cars = [
      baseCar({ id: 'a', dealScore: 50 }),
      baseCar({ id: 'b', dealScore: 90 }),
      baseCar({ id: 'c' }),
    ];
    expect(sortCars(cars, 'dealScore').map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});
