import type { Car, MarketStat } from '../types/car';

export const ANALYSIS_VERSION = 'v2-comparables';

export type AnalysisTier = 'strict' | 'balanced' | 'broad';

export interface NormalizedCarFeatures {
  brandKey?: string;
  modelKey?: string;
  year?: number;
  mileage?: number;
  mileageBand?: number;
  sellerTypeKey?: string;
  fuelKey?: string;
  gearboxKey?: string;
  regionKey?: string;
  isComplete?: boolean;
}

export interface CarValuation {
  fairPrice: number;
  confidence: number;
  savingKr: number;
  savingPct: number;
  dealScore: number;
  modelSampleSize: number;
  comparableSampleSize: number;
  valuationTier: AnalysisTier;
  normalizedFeatures: NormalizedCarFeatures;
}

export interface AnalysisRunSummary {
  calculatedAt: string;
  analysisVersion: string;
  totalCars: number;
  activeCars: number;
  archivedCars: number;
  analyzedCars: number;
  snapshotCount: number;
}

export interface AnalysisSnapshot extends MarketStat {
  year?: number;
  activeSampleSize: number;
  archivedSampleSize: number;
  analysisVersion: string;
}

export interface AnalysisResult {
  marketStats: AnalysisSnapshot[];
  carValuations: Map<string, CarValuation>;
  summary: AnalysisRunSummary;
}

type Candidate = {
  car: Car;
  weight: number;
  similarity: number;
  yearDistance: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mileageOf(car: Car): number | null {
  return asNumber(car.mileage ?? car.km);
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return normalized || undefined;
}

function normalizedFeaturesOf(car: Car): NormalizedCarFeatures {
  const features: NormalizedCarFeatures = {};
  const mileage = mileageOf(car);
  const year = asNumber(car.year);
  const brandKey = normalizeText(car.brand);
  const modelKey = normalizeText(car.model);
  const sellerTypeKey = normalizeText(car.sellerType);
  const fuelKey = normalizeText(car.fuel);
  const gearboxKey = normalizeText(car.gearbox);
  const regionKey = normalizeText(car.region ?? car.location);

  if (brandKey) features.brandKey = brandKey;
  if (modelKey) features.modelKey = modelKey;
  if (year != null) features.year = year;
  if (mileage != null) {
    features.mileage = mileage;
    features.mileageBand = Math.round(mileage / 25_000) * 25_000;
  }
  if (sellerTypeKey) features.sellerTypeKey = sellerTypeKey;
  if (fuelKey) features.fuelKey = fuelKey;
  if (gearboxKey) features.gearboxKey = gearboxKey;
  if (regionKey) features.regionKey = regionKey;
  if (typeof car.isComplete === 'boolean') features.isComplete = car.isComplete;

  return features;
}

function weightedAverage(items: Candidate[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return items.reduce((sum, item) => sum + item.car.price * item.weight, 0) / totalWeight;
}

function weightedQuantile(items: Candidate[], q: number): number {
  const sorted = items
    .filter((item) => item.weight > 0)
    .slice()
    .sort((a, b) => a.car.price - b.car.price);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (!sorted.length || totalWeight <= 0) return 0;
  const target = totalWeight * clamp(q, 0, 1);
  let seen = 0;
  for (const item of sorted) {
    seen += item.weight;
    if (seen >= target) return item.car.price;
  }
  return sorted[sorted.length - 1].car.price;
}

function tierFor(weight: number, yearDistance: number): AnalysisTier | null {
  if (weight >= 0.82 && yearDistance <= 1) return 'strict';
  if (weight >= 0.6 && yearDistance <= 2) return 'balanced';
  if (weight >= 0.38) return 'broad';
  return null;
}

function tierRank(tier: AnalysisTier): number {
  switch (tier) {
    case 'strict': return 3;
    case 'balanced': return 2;
    case 'broad': return 1;
  }
}

function pickBestTier(candidates: Candidate[]): { tier: AnalysisTier; selected: Candidate[] } | null {
  const tiers: AnalysisTier[] = ['strict', 'balanced', 'broad'];
  for (const tier of tiers) {
    const selected = candidates.filter((candidate) => {
      const candidateTier = tierFor(candidate.weight, candidate.yearDistance);
      return candidateTier != null && tierRank(candidateTier) >= tierRank(tier);
    });
    const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
    if (tier === 'strict' && selected.length >= 3 && totalWeight >= 2.4) return { tier, selected };
    if (tier === 'balanced' && selected.length >= 4 && totalWeight >= 2.8) return { tier, selected };
    if (tier === 'broad' && selected.length >= 3 && totalWeight >= 2.4) return { tier, selected };
  }
  return null;
}

function buildCandidateWeights(target: Car, candidates: Car[]): Candidate[] {
  const targetMileage = mileageOf(target);
  const targetYear = asNumber(target.year);
  const targetFeatures = normalizedFeaturesOf(target);

  return candidates
    .filter((candidate) => candidate.price > 0)
    .map((candidate) => {
      const candidateFeatures = normalizedFeaturesOf(candidate);
      const candidateYear = asNumber(candidate.year);
      const yearDistance =
        targetYear != null && candidateYear != null ? Math.abs(targetYear - candidateYear) : 3;
      const yearWeight =
        yearDistance === 0 ? 1.08
          : yearDistance === 1 ? 0.95
            : yearDistance === 2 ? 0.78
              : yearDistance === 3 ? 0.58
                : yearDistance === 4 ? 0.42
                  : 0.24;

      const candidateMileage = mileageOf(candidate);
      const mileageWeight = (() => {
        if (targetMileage == null || candidateMileage == null) return 0.72;
        const baseline = Math.max(targetMileage, candidateMileage, 40_000);
        const ratio = Math.abs(targetMileage - candidateMileage) / baseline;
        return clamp(1 - ratio * 1.7, 0.32, 1.04);
      })();

      const sellerWeight =
        targetFeatures.sellerTypeKey && candidateFeatures.sellerTypeKey
          ? targetFeatures.sellerTypeKey === candidateFeatures.sellerTypeKey ? 1.06 : 0.93
          : 0.98;
      const fuelWeight =
        targetFeatures.fuelKey && candidateFeatures.fuelKey
          ? targetFeatures.fuelKey === candidateFeatures.fuelKey ? 1.04 : 0.96
          : 1;
      const gearboxWeight =
        targetFeatures.gearboxKey && candidateFeatures.gearboxKey
          ? targetFeatures.gearboxKey === candidateFeatures.gearboxKey ? 1.03 : 0.97
          : 1;
      const regionWeight =
        targetFeatures.regionKey && candidateFeatures.regionKey
          ? targetFeatures.regionKey === candidateFeatures.regionKey ? 1.02 : 0.99
          : 1;
      const statusWeight = candidate.status === 'archived' ? 1.12 : 1;
      const completenessWeight = candidate.isComplete ? 1.03 : 0.94;
      const weight =
        yearWeight *
        mileageWeight *
        sellerWeight *
        fuelWeight *
        gearboxWeight *
        regionWeight *
        statusWeight *
        completenessWeight;
      const similarity = clamp(weight / 1.25, 0, 1);

      return { car: candidate, weight, similarity, yearDistance };
    })
    .filter((candidate) => candidate.weight >= 0.2);
}

function confidenceFor(target: Car, tier: AnalysisTier, selected: Candidate[]): number {
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  const avgSimilarity = selected.reduce((sum, item) => sum + item.similarity, 0) / selected.length;
  const sampleFactor = clamp(selected.length / 8, 0.3, 1);
  const weightFactor = clamp(totalWeight / 6, 0.35, 1);
  const tierFactor = tier === 'strict' ? 1 : tier === 'balanced' ? 0.82 : 0.68;
  const completenessFactor = mileageOf(target) != null && asNumber(target.year) != null ? 1 : 0.82;
  return clamp(sampleFactor * weightFactor * avgSimilarity * tierFactor * completenessFactor, 0.2, 0.98);
}

function buildValuation(target: Car, sameModelCars: Car[], sameModelYearCount: number): CarValuation | null {
  if (!target.brand || !target.model || !target.price || !target.year) return null;
  const comparableCars = sameModelCars.filter((candidate) => {
    const candidateId = candidate.finnId ?? candidate.id;
    const targetId = target.finnId ?? target.id;
    return candidateId !== targetId;
  });
  if (comparableCars.length < 3) return null;

  const weightedCandidates = buildCandidateWeights(target, comparableCars);
  const picked = pickBestTier(weightedCandidates);
  if (!picked) return null;

  const weightedMedian = weightedQuantile(picked.selected, 0.5);
  const weightedMean = weightedAverage(picked.selected);
  const fairPrice = Math.round(weightedMedian * 0.78 + weightedMean * 0.22);
  const confidence = confidenceFor(target, picked.tier, picked.selected);
  const savingKr = Math.round(fairPrice - target.price);
  const savingPct = fairPrice > 0 ? savingKr / fairPrice : 0;
  const positiveSavingPct = clamp(savingPct, 0, 1);
  const tierBoost = picked.tier === 'strict' ? 1 : picked.tier === 'balanced' ? 0.9 : 0.78;
  const sampleBoost = clamp(picked.selected.length / 10, 0.5, 1);
  const dealScore = Math.round(positiveSavingPct * confidence * tierBoost * sampleBoost * 100);

  return {
    fairPrice,
    confidence,
    savingKr,
    savingPct,
    dealScore,
    modelSampleSize: sameModelYearCount,
    comparableSampleSize: picked.selected.length,
    valuationTier: picked.tier,
    normalizedFeatures: normalizedFeaturesOf(target),
  };
}

function groupId(car: Car): string | null {
  if (!car.year || !car.price) return null;
  const features = normalizedFeaturesOf(car);
  if (!features.brandKey || !features.modelKey) return null;
  return `${features.brandKey}_${features.modelKey}_${car.year}`;
}

export function buildMarketAnalysis(cars: Car[], calculatedAt = new Date().toISOString()): AnalysisResult {
  const eligibleCars = cars.filter((car) => !car.isAuction && car.price > 0);
  const activeCars = eligibleCars.filter((car) => car.status === 'active');
  const archivedCars = eligibleCars.filter((car) => car.status === 'archived');

  const groups = new Map<string, Car[]>();
  const sameModelMap = new Map<string, Car[]>();

  for (const car of eligibleCars) {
    const id = groupId(car);
    if (id) {
      const grouped = groups.get(id) ?? [];
      grouped.push(car);
      groups.set(id, grouped);
    }

    const features = normalizedFeaturesOf(car);
    if (features.brandKey && features.modelKey) {
      const modelKey = `${features.brandKey}_${features.modelKey}`;
      const grouped = sameModelMap.get(modelKey) ?? [];
      grouped.push(car);
      sameModelMap.set(modelKey, grouped);
    }
  }

  const marketStats: AnalysisSnapshot[] = [];
  for (const [id, groupedCars] of groups.entries()) {
    if (groupedCars.length < 3) continue;
    const sorted = groupedCars.slice().sort((a, b) => a.price - b.price);
    const candidates = sorted.map((car) => ({
      car,
      weight: car.status === 'archived' ? 1.15 : 1,
      similarity: 1,
      yearDistance: 0,
    }));
    marketStats.push({
      id,
      brand: groupedCars[0].brand,
      model: groupedCars[0].model,
      year: groupedCars[0].year,
      avgPrice: Math.round(weightedAverage(candidates)),
      medianPrice: Math.round(weightedQuantile(candidates, 0.5)),
      sampleSize: groupedCars.length,
      activeSampleSize: groupedCars.filter((car) => car.status === 'active').length,
      archivedSampleSize: groupedCars.filter((car) => car.status === 'archived').length,
      calculatedAt,
      analysisVersion: ANALYSIS_VERSION,
    });
  }

  const carValuations = new Map<string, CarValuation>();
  for (const car of activeCars) {
    const features = normalizedFeaturesOf(car);
    if (!features.brandKey || !features.modelKey) continue;
    const sameModelCars = sameModelMap.get(`${features.brandKey}_${features.modelKey}`) ?? [];
    const sameModelYearCount = groups.get(groupId(car) ?? '')?.length ?? 0;
    const valuation = buildValuation(car, sameModelCars, sameModelYearCount);
    if (!valuation) continue;
    const key = String(car.finnId ?? car.id);
    carValuations.set(key, valuation);
  }

  return {
    marketStats,
    carValuations,
    summary: {
      calculatedAt,
      analysisVersion: ANALYSIS_VERSION,
      totalCars: eligibleCars.length,
      activeCars: activeCars.length,
      archivedCars: archivedCars.length,
      analyzedCars: carValuations.size,
      snapshotCount: marketStats.length,
    },
  };
}
