export interface Junction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description: string;
  congestion_level: 'low' | 'medium' | 'high' | 'critical';
  congestion_density: number;
}

export interface Road {
  id: number;
  junction_id: number;
  direction: string;
  road_name: string;
  latest_count?: VehicleCount | null;
}

export interface VehicleCount {
  id?: number;
  road_id?: number;
  timestamp?: string;
  cars: number;
  bikes: number;
  buses: number;
  mini_trucks: number;
  medium_trucks: number;
  big_trucks: number;
  cycles: number;
}

export interface SignalTimer {
  id: number;
  junction_id: number;
  direction: string;
  green_time: number;
  red_time: number;
  yellow_time: number;
  updated_at?: string;
}

export type SignalPhase = 'green' | 'yellow' | 'red';

export interface SignalState {
  phase: SignalPhase;
  countdown: number;
  direction: string;
}

export interface JunctionDetail {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description: string;
  roads: Road[];
  signal_timers: SignalTimer[];
}

export interface VehicleInput {
  direction: string;
  cars: number;
  bikes: number;
  buses: number;
  mini_trucks: number;
  medium_trucks: number;
  big_trucks: number;
  cycles: number;
}
