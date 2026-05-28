export interface VehicleCounts {
  cars: number;
  bikes: number;
  buses: number;
  mini_trucks: number;
  medium_trucks: number;
  big_trucks: number;
  cycles: number;
}

export interface RoadData {
  direction: string;
  vehicles: VehicleCounts;
}

export interface TimerResult {
  direction: string;
  green_time: number;
  yellow_time: number;
  red_time: number;
}

const PCU_WEIGHTS: Record<keyof VehicleCounts, number> = {
  cycles: 0.5,
  bikes: 0.75,
  cars: 1.0,
  mini_trucks: 1.5,
  medium_trucks: 2.0,
  big_trucks: 3.0,
  buses: 3.5,
};

const ROAD_CAPACITY = 50;

export function calculatePCU(vehicles: VehicleCounts): number {
  return (
    vehicles.cars * PCU_WEIGHTS.cars +
    vehicles.bikes * PCU_WEIGHTS.bikes +
    vehicles.buses * PCU_WEIGHTS.buses +
    vehicles.mini_trucks * PCU_WEIGHTS.mini_trucks +
    vehicles.medium_trucks * PCU_WEIGHTS.medium_trucks +
    vehicles.big_trucks * PCU_WEIGHTS.big_trucks +
    vehicles.cycles * PCU_WEIGHTS.cycles
  );
}

export function calculateDensity(pcu: number): number {
  const density = pcu / ROAD_CAPACITY;
  return Math.min(1, Math.max(0, density));
}

export function getCongestionLevel(density: number): 'low' | 'medium' | 'high' | 'critical' {
  if (density < 0.3) return 'low';
  if (density < 0.6) return 'medium';
  if (density < 0.85) return 'high';
  return 'critical';
}

export function calculateAdaptiveTimers(roadsData: RoadData[]): TimerResult[] {
  // Fixed 120-second total cycle: 4 × (green + 5s yellow) = 120s
  const TOTAL_CYCLE   = 120;
  const YELLOW_TIME   = 5;
  const NUM_DIR       = 4;
  const AVAIL_GREEN   = TOTAL_CYCLE - NUM_DIR * YELLOW_TIME; // 100 seconds
  const MIN_GREEN     = 10;
  // MAX per direction = leave at least MIN_GREEN for each of the other 3
  const MAX_GREEN     = AVAIL_GREEN - MIN_GREEN * (NUM_DIR - 1); // 70 seconds

  const pcuValues = roadsData.map((road) => calculatePCU(road.vehicles));
  const totalPCU  = pcuValues.reduce((sum, p) => sum + p, 0);

  let greenTimes: number[];

  if (totalPCU < 0.1) {
    // All zero — equal share: floor(100/4) = 25s each
    const equal = Math.floor(AVAIL_GREEN / NUM_DIR);
    greenTimes = roadsData.map(() => equal);
  } else {
    // Proportional allocation, clamped to [MIN_GREEN, MAX_GREEN]
    greenTimes = pcuValues.map((pcu) => {
      const proportional = (pcu / totalPCU) * AVAIL_GREEN;
      return Math.max(MIN_GREEN, Math.min(MAX_GREEN, Math.round(proportional)));
    });

    // Adjust so the sum equals AVAIL_GREEN exactly (fix rounding drift)
    let diff       = AVAIL_GREEN - greenTimes.reduce((s, t) => s + t, 0);
    let iterations = 0;

    while (diff !== 0 && iterations < 200) {
      if (diff > 0) {
        // Need to add — give to the busiest direction that is still under MAX_GREEN
        const idx = greenTimes.reduce((best, _t, i) =>
          (pcuValues[i] > pcuValues[best] && greenTimes[i] < MAX_GREEN) ? i : best, 0);
        greenTimes[idx] = Math.min(MAX_GREEN, greenTimes[idx] + 1);
        diff--;
      } else {
        // Need to remove — take from the least-busy direction still above MIN_GREEN
        const idx = greenTimes.reduce((best, _t, i) =>
          (pcuValues[i] < pcuValues[best] && greenTimes[i] > MIN_GREEN) ? i : best, 0);
        greenTimes[idx] = Math.max(MIN_GREEN, greenTimes[idx] - 1);
        diff++;
      }
      iterations++;
    }
  }

  // Build results: red_time = total cycle − own green − own yellow
  return roadsData.map((road, i) => ({
    direction:  road.direction,
    green_time: greenTimes[i],
    yellow_time: YELLOW_TIME,
    red_time:   TOTAL_CYCLE - greenTimes[i] - YELLOW_TIME,
  }));
}
