import { describe, expect, it } from 'vitest';
import { ANALYSIS_VERSION, buildMarketAnalysis } from '../src/lib/market-analysis';
import type { Car } from '../src/types/car';

const car = (overrides: Partial<Car> = {}): Car => ({
  id: overrides.id ?? String(Math.random()),
  brand: 'Mazda',
  model: 'CX-5',
  year: 2020,
  price: 200_000,
  mileage: 70_000,
  sellerType: 'forhandler',
  status: 'active',
  isAuction: false,
  isComplete: true,
  ...overrides,
});

describe('buildMarketAnalysis', () => {
  it('builds a valuation from close comparable cars', () => {
    const result = buildMarketAnalysis([
      car({ id: 'target', finnId: 'target', price: 205_000, mileage: 68_000 }),
      car({ id: 'a', finnId: 'a', price: 235_000, mileage: 60_000 }),
      car({ id: 'b', finnId: 'b', price: 228_000, mileage: 74_000 }),
      car({ id: 'c', finnId: 'c', price: 240_000, mileage: 80_000, status: 'archived', fuel: 'Bensin' }),
      car({ id: 'd', finnId: 'd', price: 232_000, mileage: 66_000 }),
      car({ id: 'e', finnId: 'e', price: 226_000, mileage: 71_000, sellerType: 'privat', gearbox: 'Automat' }),
    ], '2026-05-06T08:00:00.000Z');

    const valuation = result.carValuations.get('target');
    expect(valuation).toBeTruthy();
    expect(valuation?.fairPrice).toBeGreaterThan(220_000);
    expect(valuation?.savingKr).toBeGreaterThan(0);
    expect(valuation?.comparableSampleSize).toBeGreaterThanOrEqual(4);
    expect(valuation?.confidence).toBeGreaterThan(0.35);
    expect(valuation?.normalizedFeatures).toMatchObject({
      brandKey: 'mazda',
      modelKey: 'cx-5',
      mileageBand: 75_000,
      sellerTypeKey: 'forhandler',
    });
  });

  it('prefers close-year comparables and ignores far-away years as strict matches', () => {
    const result = buildMarketAnalysis([
      car({ id: 'target', finnId: 'target', year: 2020, price: 205_000 }),
      car({ id: 'a', finnId: 'a', year: 2020, price: 230_000 }),
      car({ id: 'b', finnId: 'b', year: 2021, price: 229_000 }),
      car({ id: 'c', finnId: 'c', year: 2019, price: 228_000 }),
      car({ id: 'd', finnId: 'd', year: 2016, price: 180_000 }),
      car({ id: 'e', finnId: 'e', year: 2015, price: 175_000 }),
      car({ id: 'f', finnId: 'f', year: 2014, price: 170_000 }),
    ]);

    const valuation = result.carValuations.get('target');
    expect(valuation).toBeTruthy();
    expect(valuation?.fairPrice).toBeGreaterThan(220_000);
    expect(valuation?.valuationTier === 'strict' || valuation?.valuationTier === 'balanced').toBe(true);
  });

  it('creates historical snapshot rows per model-year group', () => {
    const result = buildMarketAnalysis([
      car({ id: 'a', finnId: 'a', year: 2020, price: 220_000 }),
      car({ id: 'b', finnId: 'b', year: 2020, price: 225_000 }),
      car({ id: 'c', finnId: 'c', year: 2020, price: 230_000, status: 'archived' }),
      car({ id: 'd', finnId: 'd', year: 2021, price: 260_000 }),
      car({ id: 'e', finnId: 'e', year: 2021, price: 255_000 }),
      car({ id: 'f', finnId: 'f', year: 2021, price: 265_000 }),
    ], '2026-05-06T08:00:00.000Z');

    expect(result.summary.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(result.marketStats).toHaveLength(2);
    expect(result.marketStats[0]?.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(result.marketStats[0]?.sampleSize).toBeGreaterThanOrEqual(3);
  });
});
