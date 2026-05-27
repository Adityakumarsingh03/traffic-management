import {
  calculatePCU,
  calculateDensity,
  getCongestionLevel,
  VehicleCounts,
} from '../src/services/densityService';

const emptyVehicles: VehicleCounts = {
  cars: 0, bikes: 0, buses: 0,
  mini_trucks: 0, medium_trucks: 0, big_trucks: 0, cycles: 0,
};

describe('calculatePCU', () => {
  it('10 cars = 10 PCU', () => {
    expect(calculatePCU({ ...emptyVehicles, cars: 10 })).toBe(10);
  });

  it('10 bikes = 7.5 PCU', () => {
    expect(calculatePCU({ ...emptyVehicles, bikes: 10 })).toBe(7.5);
  });

  it('10 buses = 35 PCU', () => {
    expect(calculatePCU({ ...emptyVehicles, buses: 10 })).toBe(35);
  });

  it('mixed counts give correct sum', () => {
    const vehicles: VehicleCounts = {
      cars: 5,        // 5 * 1.0 = 5
      bikes: 4,       // 4 * 0.75 = 3
      buses: 2,       // 2 * 3.5 = 7
      mini_trucks: 3, // 3 * 1.5 = 4.5
      medium_trucks: 1, // 1 * 2.0 = 2
      big_trucks: 1,  // 1 * 3.0 = 3
      cycles: 2,      // 2 * 0.5 = 1
    };
    // Total = 5 + 3 + 7 + 4.5 + 2 + 3 + 1 = 25.5
    expect(calculatePCU(vehicles)).toBe(25.5);
  });

  it('zero vehicles = 0 PCU', () => {
    expect(calculatePCU(emptyVehicles)).toBe(0);
  });
});

describe('calculateDensity', () => {
  it('25 PCU = 0.5 density', () => {
    expect(calculateDensity(25)).toBe(0.5);
  });

  it('50 PCU = 1.0 (clamped)', () => {
    expect(calculateDensity(50)).toBe(1.0);
  });

  it('100 PCU = 1.0 (clamped at max)', () => {
    expect(calculateDensity(100)).toBe(1.0);
  });

  it('0 PCU = 0 density', () => {
    expect(calculateDensity(0)).toBe(0);
  });

  it('negative PCU = 0 (clamped at min)', () => {
    expect(calculateDensity(-10)).toBe(0);
  });
});

describe('getCongestionLevel', () => {
  it('density 0.2 = low', () => {
    expect(getCongestionLevel(0.2)).toBe('low');
  });

  it('density 0.5 = medium', () => {
    expect(getCongestionLevel(0.5)).toBe('medium');
  });

  it('density 0.7 = high', () => {
    expect(getCongestionLevel(0.7)).toBe('high');
  });

  it('density 0.9 = critical', () => {
    expect(getCongestionLevel(0.9)).toBe('critical');
  });

  it('density 0.0 = low', () => {
    expect(getCongestionLevel(0.0)).toBe('low');
  });

  it('density 0.85 = critical', () => {
    expect(getCongestionLevel(0.85)).toBe('critical');
  });

  it('density 0.3 = medium', () => {
    expect(getCongestionLevel(0.3)).toBe('medium');
  });

  it('density 0.6 = high', () => {
    expect(getCongestionLevel(0.6)).toBe('high');
  });
});
