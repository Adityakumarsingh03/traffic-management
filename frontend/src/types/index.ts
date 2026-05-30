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

/** All vehicle types including Indian-specific ones */
export interface VehicleCount {
  id?: number;
  road_id?: number;
  timestamp?: string;
  // Original types
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

/** Input shape used when submitting vehicle counts from the dashboard */
export interface VehicleInput {
  direction: string;
  // Original types
  cars:          number;
  bikes:         number;
  buses:         number;
  mini_trucks:   number;
  medium_trucks: number;
  big_trucks:    number;
  cycles:        number;
  // Indian-specific types
  auto_rickshaws: number;
  e_rickshaws:    number;
  tempos:         number;
  tractors:       number;
}

/** Detection result from the Python model API */
export interface DetectionResult {
  success:            boolean;
  counts:             Record<string, number>;
  detections:         DetectionBox[];
  total_vehicles:     number;
  total_pcu:          number;
  density:            number;
  congestion_level:   'low' | 'medium' | 'high' | 'critical';
  annotated_image:    string;   // data:image/jpeg;base64,...
  image_size:         { width: number; height: number };
  model_info:         ModelInfo;
  training_data_saved: boolean;
}

export interface DetectionBox {
  type:           string;
  original_class: string;
  confidence:     number;
  bbox:           [number, number, number, number];
  pcu:            number;
  label:          string;
}

export interface ModelInfo {
  name:        string;
  source:      string;
  mAP?:        number;
  classes?:    string[];
  trained_on?: string[];
  note?:       string;
}
