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

describe('calculateAdaptiveTimers', () => {
  it('equal load on all 4 roads gives roughly equal green times', () => {
    const roads = makeRoads([10, 10, 10, 10]);
    const timers = calculateAdaptiveTimers(roads);
    const greenTimes = timers.map((t) => t.green_time);

    // All green times should be equal
    expect(greenTimes[0]).toBe(greenTimes[1]);
    expect(greenTimes[1]).toBe(greenTimes[2]);
    expect(greenTimes[2]).toBe(greenTimes[3]);
  });

  it('100% load on one road gives that road maximum green time', () => {
    const roads = makeRoads([100, 0, 0, 0]);
    const timers = calculateAdaptiveTimers(roads);

    const maxTimer = timers.find((t) => t.direction === 'N');
    const otherTimers = timers.filter((t) => t.direction !== 'N');

    expect(maxTimer).toBeDefined();
    // The heavily loaded road should get more green time than others
    for (const other of otherTimers) {
      expect(maxTimer!.green_time).toBeGreaterThanOrEqual(other.green_time);
    }
    // Heavy road should be clamped to MAX_GREEN=120
    expect(maxTimer!.green_time).toBe(120);
  });

  it('all returned green times are between 10 and 120', () => {
    const testCases = [
      makeRoads([50, 20, 10, 5]),
      makeRoads([100, 0, 0, 0]),
      makeRoads([1, 1, 1, 1]),
      makeRoads([0, 0, 0, 0]),
    ];

    for (const roads of testCases) {
      const timers = calculateAdaptiveTimers(roads);
      for (const timer of timers) {
        expect(timer.green_time).toBeGreaterThanOrEqual(10);
        expect(timer.green_time).toBeLessThanOrEqual(120);
      }
    }
  });

  it('0 total PCU gives 30s green to all directions', () => {
    const roads = makeRoads([0, 0, 0, 0]);
    const timers = calculateAdaptiveTimers(roads);

    for (const timer of timers) {
      expect(timer.green_time).toBe(30);
    }
  });

  it('yellow time is always 5 seconds', () => {
    const roads = makeRoads([10, 20, 15, 5]);
    const timers = calculateAdaptiveTimers(roads);

    for (const timer of timers) {
      expect(timer.yellow_time).toBe(5);
    }
  });

  it('red time is correctly calculated from cycle time', () => {
    const roads = makeRoads([10, 10, 10, 10]);
    const timers = calculateAdaptiveTimers(roads);

    const totalCycle = timers.reduce((sum, t) => sum + t.green_time + t.yellow_time, 0);

    for (const timer of timers) {
      expect(timer.red_time).toBe(totalCycle - timer.green_time - timer.yellow_time);
    }
  });
});
