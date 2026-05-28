import { calculateAdaptiveTimers, RoadData, VehicleCounts } from '../src/services/densityService';

const emptyVehicles: VehicleCounts = {
  cars: 0, bikes: 0, buses: 0,
  mini_trucks: 0, medium_trucks: 0, big_trucks: 0, cycles: 0,
};

const makeRoads = (pcuValues: number[]): RoadData[] => {
  const directions = ['N', 'S', 'E', 'W'];
  return pcuValues.map((cars, i) => ({
    direction: directions[i],
    vehicles: { ...emptyVehicles, cars },
  }));
};

// ── Constants that mirror densityService ──────────────────────────────────────
const TOTAL_CYCLE  = 120;
const YELLOW_TIME  = 5;
const NUM_DIR      = 4;
const AVAIL_GREEN  = TOTAL_CYCLE - NUM_DIR * YELLOW_TIME; // 100
const MIN_GREEN    = 10;
const MAX_GREEN    = AVAIL_GREEN - MIN_GREEN * (NUM_DIR - 1); // 70

describe('calculateAdaptiveTimers — strict 120s total cycle', () => {

  it('total cycle is always exactly 120 s (equal load)', () => {
    const timers = calculateAdaptiveTimers(makeRoads([10, 10, 10, 10]));
    const total = timers.reduce((s, t) => s + t.green_time + t.yellow_time, 0);
    expect(total).toBe(TOTAL_CYCLE);
  });

  it('total cycle is always exactly 120 s (heavy one direction)', () => {
    const timers = calculateAdaptiveTimers(makeRoads([100, 0, 0, 0]));
    const total = timers.reduce((s, t) => s + t.green_time + t.yellow_time, 0);
    expect(total).toBe(TOTAL_CYCLE);
  });

  it('total cycle is always exactly 120 s (zero PCU)', () => {
    const timers = calculateAdaptiveTimers(makeRoads([0, 0, 0, 0]));
    const total = timers.reduce((s, t) => s + t.green_time + t.yellow_time, 0);
    expect(total).toBe(TOTAL_CYCLE);
  });

  it('total cycle is always exactly 120 s (mixed load)', () => {
    const timers = calculateAdaptiveTimers(makeRoads([50, 20, 10, 5]));
    const total = timers.reduce((s, t) => s + t.green_time + t.yellow_time, 0);
    expect(total).toBe(TOTAL_CYCLE);
  });

  it('equal load gives equal green times (25 s each)', () => {
    const timers = calculateAdaptiveTimers(makeRoads([10, 10, 10, 10]));
    for (const t of timers) {
      expect(t.green_time).toBe(25);
    }
  });

  it('0 total PCU gives 25 s green to every direction', () => {
    const timers = calculateAdaptiveTimers(makeRoads([0, 0, 0, 0]));
    for (const t of timers) {
      expect(t.green_time).toBe(25);
    }
  });

  it('100% load on one direction clamps to MAX_GREEN (70 s)', () => {
    const timers = calculateAdaptiveTimers(makeRoads([100, 0, 0, 0]));
    const north  = timers.find((t) => t.direction === 'N')!;
    expect(north.green_time).toBe(MAX_GREEN); // 70
    // Others get MIN_GREEN (10) so total = 70+10+10+10 = 100 green ✓
    const others = timers.filter((t) => t.direction !== 'N');
    for (const t of others) {
      expect(t.green_time).toBe(MIN_GREEN);
    }
  });

  it('all green times are within [MIN_GREEN, MAX_GREEN]', () => {
    const cases = [
      makeRoads([50, 20, 10, 5]),
      makeRoads([100, 0, 0, 0]),
      makeRoads([1, 1, 1, 1]),
      makeRoads([0, 0, 0, 0]),
    ];
    for (const roads of cases) {
      for (const t of calculateAdaptiveTimers(roads)) {
        expect(t.green_time).toBeGreaterThanOrEqual(MIN_GREEN);
        expect(t.green_time).toBeLessThanOrEqual(MAX_GREEN);
      }
    }
  });

  it('yellow time is always 5 s', () => {
    for (const t of calculateAdaptiveTimers(makeRoads([10, 20, 15, 5]))) {
      expect(t.yellow_time).toBe(YELLOW_TIME);
    }
  });

  it('red_time = TOTAL_CYCLE − green − yellow for every direction', () => {
    for (const t of calculateAdaptiveTimers(makeRoads([10, 10, 10, 10]))) {
      expect(t.red_time).toBe(TOTAL_CYCLE - t.green_time - t.yellow_time);
    }
  });

  it('heavy direction gets proportionally more green than light direction', () => {
    const timers = calculateAdaptiveTimers(makeRoads([80, 10, 5, 5]));
    const north  = timers.find((t) => t.direction === 'N')!;
    const south  = timers.find((t) => t.direction === 'S')!;
    expect(north.green_time).toBeGreaterThan(south.green_time);
  });
});
