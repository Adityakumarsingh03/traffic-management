import { create } from 'zustand';
import axios from 'axios';
import { Junction, JunctionDetail, SignalState, VehicleInput } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface TrafficStore {
  junctions: Junction[];
  selectedJunction: JunctionDetail | null;
  signalStates: Record<string, SignalState>;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;

  fetchJunctions: () => Promise<void>;
  fetchJunctionDetail: (id: number) => Promise<void>;
  submitVehicleCounts: (id: number, roadsData: VehicleInput[]) => Promise<{ timers: Array<{ direction: string; green_time: number; yellow_time: number; red_time: number }>; congestion: Record<string, { density: number; level: string }> } | null>;
  updateSignalState: (direction: string, state: SignalState) => void;
}

export const useTrafficStore = create<TrafficStore>((set) => ({
  junctions: [],
  selectedJunction: null,
  signalStates: {},
  loading: false,
  error: null,
  lastUpdated: null,

  fetchJunctions: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.get<Junction[]>(`${API_BASE}/junctions`);
      set({ junctions: data, loading: false, lastUpdated: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch junctions';
      set({ error: message, loading: false });
    }
  },

  fetchJunctionDetail: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.get<JunctionDetail>(`${API_BASE}/junctions/${id}`);
      set({ selectedJunction: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch junction detail';
      set({ error: message, loading: false });
    }
  },

  submitVehicleCounts: async (id: number, roadsData: VehicleInput[]) => {
    try {
      // Normalise optional Indian vehicle fields to 0 so the backend always receives them
      const normalised = roadsData.map(r => ({
        ...r,
        auto_rickshaws: r.auto_rickshaws ?? 0,
        e_rickshaws:    r.e_rickshaws    ?? 0,
        tempos:         r.tempos         ?? 0,
        tractors:       r.tractors       ?? 0,
      }));
      const { data } = await axios.post(`${API_BASE}/junctions/${id}/vehicles`, {
        roads: normalised,
      });

      // Update selected junction with new timers
      set((state) => {
        if (state.selectedJunction) {
          return {
            selectedJunction: {
              ...state.selectedJunction,
              signal_timers: data.timers.map((t: { direction: string; green_time: number; red_time: number; yellow_time: number }) => ({
                id: 0,
                junction_id: id,
                direction: t.direction,
                green_time: t.green_time,
                red_time: t.red_time,
                yellow_time: t.yellow_time,
                updated_at: new Date().toISOString(),
              })),
            },
          };
        }
        return {};
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit vehicle counts';
      set({ error: message });
      return null;
    }
  },

  updateSignalState: (direction: string, state: SignalState) => {
    set((prev) => ({
      signalStates: {
        ...prev.signalStates,
        [direction]: state,
      },
    }));
  },
}));
