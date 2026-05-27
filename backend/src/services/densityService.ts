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
const YELLOW_TIME = 5;
const MIN_GREEN = 10;
const MAX_GREEN = 120;
const DEFAULT_GREEN = 30;

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
  const pcuPerRoad = roadsData.map((road) => ({
    direction: road.direction,
    pcu: calculatePCU(road.vehicles),
  }));

  const totalPcu = pcuPerRoad.reduce((sum, r) => sum + r.pcu, 0);

  // Webster-style proportional allocation:
  // Each direction gets a share of MAX_GREEN proportional to its PCU contribution.
  // This naturally gives MAX_GREEN (120) to a road with 100% of total traffic.
  const timers: TimerResult[] = pcuPerRoad.map(({ direction, pcu }) => {
    let greenTime: number;

    if (totalPcu === 0) {
      greenTime = DEFAULT_GREEN;
    } else {
      greenTime = Math.round((pcu / totalPcu) * MAX_GREEN);
    }

    greenTime = Math.min(MAX_GREEN, Math.max(MIN_GREEN, greenTime));

    return {
      direction,
      green_time: greenTime,
      yellow_time: YELLOW_TIME,
      red_time: 0, // calculated below
    };
  });

  // Total cycle time = sum of all (green + yellow) phases
  const totalCycle = timers.reduce((sum, t) => sum + t.green_time + t.yellow_time, 0);

  // Red time for each direction = total cycle - own green - own yellow
  for (const timer of timers) {
    timer.red_time = totalCycle - timer.green_time - timer.yellow_time;
  }

  return timers;
}
