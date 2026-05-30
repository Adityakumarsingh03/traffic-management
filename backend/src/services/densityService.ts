/** Vehicle counts — all keys map to the PCU_WEIGHTS table. */
export interface VehicleCounts {
  // Standard types
  cars:          number;
  bikes:         number;
  buses:         number;
  mini_trucks:   number;
  medium_trucks: number;
  big_trucks:    number;
  cycles:        number;
  // Indian-specific types
  auto_rickshaws?: number;
  e_rickshaws?:    number;
  tempos?:         number;
  tractors?:       number;
}

export interface RoadData {
  direction: string;
  vehicles:  VehicleCounts;
}

export interface TimerResult {
  direction:   string;
  green_time:  number;
  yellow_time: number;
  red_time:    number;
}

/**
 * PCU (Passenger Car Unit) weights for Indian road vehicles.
 * Adding a new vehicle type here is all that is needed — calculatePCU
 * iterates dynamically so no other code changes are required.
 *
 * Sources:
 *   IRC:106-1990 (Indian Roads Congress), adapted for urban mixed traffic.
 */
const PCU_WEIGHTS: Record<string, number> = {
  // Standard
  cars:          1.0,
  bikes:         0.75,
  buses:         3.5,
  mini_trucks:   1.5,
  medium_trucks: 2.0,
  big_trucks:    3.0,
  cycles:        0.5,
  // Indian-specific
  auto_rickshaws: 1.2,
  e_rickshaws:    0.8,
  tempos:         1.8,
  tractors:       2.5,
};

const ROAD_CAPACITY = 50;   // PCU threshold for 100 % density

/**
 * Calculate total PCU from a vehicle-count object.
 * Iterates dynamically so new keys in PCU_WEIGHTS are picked up automatically.
 */
export function calculatePCU(vehicles: VehicleCounts): number {
  let total = 0;
  for (const [key, weight] of Object.entries(PCU_WEIGHTS)) {
    const count = (vehicles as unknown as Record<string, number | undefined>)[key] ?? 0;
    total += count * weight;
  }
  return total;
}

export function calculateDensity(pcu: number): number {
  return Math.min(1, Math.max(0, pcu / ROAD_CAPACITY));
}

export function getCongestionLevel(density: number): 'low' | 'medium' | 'high' | 'critical' {
  if (density < 0.30) return 'low';
  if (density < 0.60) return 'medium';
  if (density < 0.85) return 'high';
  return 'critical';
}

/**
 * Webster-inspired adaptive signal timer that enforces a strict 120-second
 * total cycle regardless of vehicle density.
 *
 * Cycle contract:
 *   4 directions × (green_time + 5 s yellow) = 120 s
 *   Available green = 120 − 4×5 = 100 s
 *   MIN green per direction = 10 s
 *   MAX green per direction = 70 s  (leaves ≥10 s for each of the other 3)
 */
export function calculateAdaptiveTimers(roadsData: RoadData[]): TimerResult[] {
  const TOTAL_CYCLE = 120;
  const YELLOW_TIME = 5;
  const NUM_DIR     = 4;
  const AVAIL_GREEN = TOTAL_CYCLE - NUM_DIR * YELLOW_TIME; // 100 s
  const MIN_GREEN   = 10;
  const MAX_GREEN   = AVAIL_GREEN - MIN_GREEN * (NUM_DIR - 1); // 70 s

  const pcuValues = roadsData.map((road) => calculatePCU(road.vehicles));
  const totalPCU  = pcuValues.reduce((s, p) => s + p, 0);

  let greenTimes: number[];

  if (totalPCU < 0.1) {
    // All zero — equal share
    const equal = Math.floor(AVAIL_GREEN / NUM_DIR); // 25 s
    greenTimes  = roadsData.map(() => equal);
  } else {
    // Proportional, clamped to [MIN_GREEN, MAX_GREEN]
    greenTimes = pcuValues.map((pcu) =>
      Math.max(MIN_GREEN, Math.min(MAX_GREEN, Math.round((pcu / totalPCU) * AVAIL_GREEN)))
    );

    // Correct rounding drift so sum always equals AVAIL_GREEN exactly
    let diff       = AVAIL_GREEN - greenTimes.reduce((s, t) => s + t, 0);
    let iterations = 0;

    while (diff !== 0 && iterations < 200) {
      if (diff > 0) {
        const idx = greenTimes.reduce((best, _t, i) =>
          pcuValues[i] > pcuValues[best] && greenTimes[i] < MAX_GREEN ? i : best, 0);
        greenTimes[idx] = Math.min(MAX_GREEN, greenTimes[idx] + 1);
        diff--;
      } else {
        const idx = greenTimes.reduce((best, _t, i) =>
          pcuValues[i] < pcuValues[best] && greenTimes[i] > MIN_GREEN ? i : best, 0);
        greenTimes[idx] = Math.max(MIN_GREEN, greenTimes[idx] - 1);
        diff++;
      }
      iterations++;
    }
  }

  return roadsData.map((road, i) => ({
    direction:   road.direction,
    green_time:  greenTimes[i],
    yellow_time: YELLOW_TIME,
    red_time:    TOTAL_CYCLE - greenTimes[i] - YELLOW_TIME,
  }));
}
