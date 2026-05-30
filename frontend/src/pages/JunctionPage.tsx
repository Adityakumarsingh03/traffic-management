import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTrafficStore } from '../store/trafficStore';
import { useSignalTimer } from '../hooks/useSignalTimer';
import { SignalLight } from '../components/SignalLight/SignalLight';
import { VehicleInput, SignalTimer, DetectionResult } from '../types';

const DIRECTIONS = ['N', 'S', 'E', 'W'] as const;
type Direction = typeof DIRECTIONS[number];

interface VehicleType {
  key: keyof Omit<VehicleInput, 'direction'>;
  label: string;
  icon: string;
  pcu: number;
  indian?: boolean;   // true = Indian-specific vehicle
}

const VEHICLE_TYPES: VehicleType[] = [
  { key: 'cars',           label: 'Car',           icon: '🚗', pcu: 1.0  },
  { key: 'bikes',          label: 'Motorcycle',     icon: '🏍', pcu: 0.75 },
  { key: 'auto_rickshaws', label: 'Auto Rickshaw',  icon: '🛺', pcu: 1.2,  indian: true },
  { key: 'buses',          label: 'Bus',            icon: '🚌', pcu: 3.5  },
  { key: 'mini_trucks',    label: 'Mini Truck',     icon: '🚐', pcu: 1.5  },
  { key: 'medium_trucks',  label: 'Medium Truck',   icon: '🚛', pcu: 2.0  },
  { key: 'big_trucks',     label: 'Big Truck',      icon: '🏗', pcu: 3.0  },
  { key: 'cycles',         label: 'Bicycle',        icon: '🚲', pcu: 0.5  },
  { key: 'e_rickshaws',    label: 'E-Rickshaw',     icon: '🛺', pcu: 0.8,  indian: true },
  { key: 'tempos',         label: 'Tempo',          icon: '🚐', pcu: 1.8,  indian: true },
  { key: 'tractors',       label: 'Tractor',        icon: '🚜', pcu: 2.5,  indian: true },
];

const emptyVehicleInput = (): Omit<VehicleInput, 'direction'> => ({
  cars: 0, bikes: 0, buses: 0,
  mini_trucks: 0, medium_trucks: 0, big_trucks: 0, cycles: 0,
  auto_rickshaws: 0, e_rickshaws: 0, tempos: 0, tractors: 0,
});

function calcPCU(input: Omit<VehicleInput, 'direction'>): number {
  return VEHICLE_TYPES.reduce((sum, vt) => sum + ((input[vt.key] as number) || 0) * vt.pcu, 0);
}

function getDensityColor(d: number): string {
  if (d < 0.3)  return '#16a34a';
  if (d < 0.6)  return '#d97706';
  if (d < 0.85) return '#ea580c';
  return '#dc2626';
}

function getCongestionLabel(d: number): string {
  if (d < 0.3)  return 'LOW';
  if (d < 0.6)  return 'MEDIUM';
  if (d < 0.85) return 'HIGH';
  return 'CRITICAL';
}

const ROAD_CAPACITY = 50;

/* ── Tiny section header ─────────────────────────────────────────────────── */
function SectionTitle({ icon, text, accent }: { icon: string; text: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <h2 style={{
        fontFamily: 'Orbitron', fontSize: '0.82rem', fontWeight: 700,
        color: accent || '#1a2744', margin: 0, letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        {text}
      </h2>
    </div>
  );
}

/* ── Model info badge ────────────────────────────────────────────────────── */
function ModelBadge({ info }: { info: DetectionResult['model_info'] }) {
  const sources: Record<string, string> = {
    roboflow:          '🇮🇳 IDD+ACID+Indian Traffic',
    huggingface:       '🤗 Hugging Face',
    ultralytics_default: '⚡ COCO (fallback)',
    default:           '⚡ COCO (fallback)',
  };
  const trained = sources[info.source] || info.source;

  return (
    <div style={{
      background: 'rgba(26,39,68,0.06)',
      border: '1px solid rgba(26,39,68,0.15)',
      borderLeft: '3px solid #c8960c',
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: 'Rajdhani',
      fontSize: '0.82rem',
      color: '#3d3527',
    }}>
      <span style={{ fontWeight: 700, color: '#1a2744' }}>Model: </span>{info.name}
      {info.mAP && (
        <span style={{ marginLeft: 8, color: '#15803d', fontWeight: 700 }}>
          mAP {info.mAP}%
        </span>
      )}
      <span style={{ marginLeft: 8, color: '#78716c' }}>| Trained on: {trained}</span>
    </div>
  );
}

/* ── AI Detection badge counts ───────────────────────────────────────────── */
function DetectionCounts({ counts }: { counts: Record<string, number> }) {
  const nonZero = Object.entries(counts).filter(([, v]) => v > 0);
  if (nonZero.length === 0) return null;

  const labelMap: Record<string, string> = {
    cars: 'Car', bikes: 'Bike', buses: 'Bus',
    mini_trucks: 'Mini Truck', medium_trucks: 'Med. Truck', big_trucks: 'Big Truck',
    cycles: 'Cycle', auto_rickshaws: 'Auto', e_rickshaws: 'E-Rick', tempos: 'Tempo',
    tractors: 'Tractor',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {nonZero.map(([k, v]) => (
        <span key={k} style={{
          background: '#1a2744',
          color: '#f0e8d0',
          borderRadius: 3,
          padding: '2px 8px',
          fontFamily: 'Orbitron',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}>
          {labelMap[k] || k}: {v}
        </span>
      ))}
    </div>
  );
}

export default function JunctionPage() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const { selectedJunction, fetchJunctionDetail, submitVehicleCounts } = useTrafficStore();

  const [activeTab, setActiveTab] = useState<Direction>('N');
  const [vehicleInputs, setVehicleInputs] = useState<Record<Direction, Omit<VehicleInput, 'direction'>>>({
    N: emptyVehicleInput(), S: emptyVehicleInput(),
    E: emptyVehicleInput(), W: emptyVehicleInput(),
  });
  const [toast, setToast]       = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<{
    oldTimers: SignalTimer[];
    newTimers: Array<{ direction: string; green_time: number; yellow_time: number; red_time: number }>;
  } | null>(null);

  useEffect(() => {
    if (id) fetchJunctionDetail(parseInt(id));
  }, [id, fetchJunctionDetail]);

  const timers           = selectedJunction?.signal_timers || [];
  const signals          = useSignalTimer(timers);
  const getActiveDir     = () => Object.entries(signals).find(([, s]) => s.phase === 'green')?.[0] || 'N';
  const getCycleLength   = () => timers.reduce((sum, t) => sum + t.green_time + t.yellow_time, 0);
  const getRoadName      = (dir: string) =>
    selectedJunction?.roads.find(r => r.direction === dir)?.road_name || `${dir} Road`;
  const getTimer         = (dir: string): SignalTimer =>
    timers.find(t => t.direction === dir) ||
    { id: 0, junction_id: 0, direction: dir, green_time: 25, yellow_time: 5, red_time: 90 };

  const handleVehicleChange = (
    dir: Direction,
    key: keyof Omit<VehicleInput, 'direction'>,
    value: string,
  ) => {
    const num = Math.max(0, parseInt(value) || 0);
    setVehicleInputs(prev => ({ ...prev, [dir]: { ...prev[dir], [key]: num } }));
  };

  /** Auto-fill vehicle inputs from AI detection result */
  const applyDetectionCounts = useCallback((det: DetectionResult) => {
    const c = det.counts;
    const merged: Omit<VehicleInput, 'direction'> = {
      cars:           c['cars']           || 0,
      bikes:          c['bikes']          || 0,
      buses:          c['buses']          || 0,
      mini_trucks:    c['mini_trucks']    || 0,
      medium_trucks:  c['medium_trucks']  || 0,
      big_trucks:     c['big_trucks']     || 0,
      cycles:         c['cycles']         || 0,
      auto_rickshaws: c['auto_rickshaws'] || 0,
      e_rickshaws:    c['e_rickshaws']    || 0,
      tempos:         c['tempos']         || 0,
      tractors:       c['tractors']       || 0,
    };
    setVehicleInputs(prev => ({ ...prev, [activeTab]: merged }));
  }, [activeTab]);

  const handleOptimize = useCallback(async () => {
    if (!id) return;
    const oldTimers = [...timers];
    const roadsData: VehicleInput[] = DIRECTIONS.map(dir => ({ direction: dir, ...vehicleInputs[dir] }));
    const result = await submitVehicleCounts(parseInt(id), roadsData);
    if (result) {
      setOptimizationResult({ oldTimers, newTimers: result.timers });
      setToast('✅ AI has recalculated optimal signal timings');
      setTimeout(() => setToast(null), 4000);
    }
  }, [id, timers, vehicleInputs, submitVehicleCounts]);

  const currentDirPCU  = calcPCU(vehicleInputs[activeTab]);
  const currentDensity = Math.min(1, currentDirPCU / ROAD_CAPACITY);
  const densityColor   = getDensityColor(currentDensity);

  const chartData = optimizationResult
    ? DIRECTIONS.map(dir => ({
        direction:  dir,
        'Old Green': optimizationResult.oldTimers.find(t => t.direction === dir)?.green_time ?? 25,
        'New Green': optimizationResult.newTimers.find(t => t.direction === dir)?.green_time ?? 25,
      }))
    : [];

  /* Loading skeleton */
  if (!selectedJunction) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f0ebe0',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52,
            border: '3px solid rgba(26,39,68,0.15)', borderTop: '3px solid #1a2744',
            borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 14px',
          }} />
          <div style={{ fontFamily: 'Orbitron', color: '#1a2744', fontSize: '0.85rem', letterSpacing: 2 }}>
            LOADING JUNCTION DATA...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#f0ebe0', display: 'flex', flexDirection: 'column' }}>

      {toast && <div className="toast">{toast}</div>}

      {/* ── Police Navy Header ──────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #111c36 0%, #1a2744 60%, #253460 100%)',
        borderBottom: '3px solid #c8960c', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        flexShrink: 0, boxShadow: '0 3px 12px rgba(17,28,54,0.5)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#e8edf8', padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'Orbitron', fontSize: '0.7rem', letterSpacing: 1, transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >
          ← BACK
        </button>
        <div style={{ width: 4, height: 36, background: 'linear-gradient(180deg,#c8960c,#e6b020,#c8960c)', borderRadius: 2 }} />
        <div>
          <h1 style={{ fontFamily: 'Orbitron', fontSize: '1.05rem', fontWeight: 900, color: '#f0e8d0', margin: 0, letterSpacing: 3 }}>
            {selectedJunction.name.toUpperCase()}
          </h1>
          <p style={{ fontFamily: 'Rajdhani', fontSize: '0.78rem', color: '#8fa0c8', margin: 0, letterSpacing: 1 }}>
            {selectedJunction.description.toUpperCase()}  •  JUNCTION ID: {selectedJunction.id}
          </p>
        </div>
      </div>

      {/* ── Main two-column layout ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: 14, overflow: 'auto' }}>

        {/* ─ LEFT: Signal Status ──────────────────────────────────────── */}
        <div className="panel panel-signal" style={{ width: '40%', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle icon="📡" text="Signal Status" accent="#1a2744" />

          {/* 2×2 signal grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, justifyItems: 'center' }}>
            {DIRECTIONS.map(dir => {
              const sig   = signals[dir] || { phase: 'red' as const, countdown: 0 };
              const timer = getTimer(dir);
              return (
                <SignalLight
                  key={dir} direction={dir} roadName={getRoadName(dir)}
                  phase={sig.phase} countdown={sig.countdown}
                  greenTime={timer.green_time} isActive={sig.phase === 'green'}
                />
              );
            })}
          </div>

          {/* Active / cycle summary */}
          <div style={{ background: '#f0ebe0', border: '1px solid rgba(26,39,68,0.15)', borderRadius: 5, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: '1rem', marginBottom: 5 }}>
              <span style={{ color: '#78716c' }}>Active Green: </span>
              <span style={{ color: '#15803d', fontFamily: 'Orbitron', fontWeight: 700 }}>{getActiveDir()}</span>
            </div>
            <div style={{ fontFamily: 'Rajdhani', fontSize: '1rem' }}>
              <span style={{ color: '#78716c' }}>Cycle Length: </span>
              <span style={{ color: '#1a2744', fontFamily: 'Orbitron', fontWeight: 700 }}>{getCycleLength()}s</span>
            </div>
          </div>

          {/* Per-direction timer mini-cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DIRECTIONS.map(dir => {
              const timer   = getTimer(dir);
              const isGreen = signals[dir]?.phase === 'green';
              return (
                <div key={dir} style={{
                  background: isGreen ? 'rgba(21,128,61,0.06)' : '#fff',
                  border: '1px solid rgba(26,39,68,0.12)',
                  borderTop: `3px solid ${isGreen ? '#15803d' : '#1a2744'}`,
                  borderRadius: 5, padding: '8px 10px', transition: 'all 0.3s',
                }}>
                  <div style={{ fontFamily: 'Orbitron', fontSize: '0.72rem', fontWeight: 700, color: isGreen ? '#15803d' : '#1a2744', marginBottom: 4 }}>
                    {dir} — {getRoadName(dir).split(' ').slice(0, 2).join(' ')}
                  </div>
                  <div style={{ fontFamily: 'Rajdhani', fontSize: '0.85rem', color: '#3d3527' }}>
                    🟢 {timer.green_time}s &nbsp;🟡 {timer.yellow_time}s &nbsp;🔴 {timer.red_time}s
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ RIGHT: Vehicle Input + AI Detection + Results ────────────── */}
        <div className="panel panel-input" style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>

          <SectionTitle icon="🚦" text="Vehicle Count Input" accent="#c8960c" />

          {/* Direction tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DIRECTIONS.map(dir => (
              <button key={dir} className={`tab-btn ${activeTab === dir ? 'active' : ''}`} onClick={() => setActiveTab(dir)}>
                {dir} — {getRoadName(dir).split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>

          {/* AI Detection result (if any) */}
          {detection && (
            <div className="animate-fade-in" style={{
              background: 'rgba(26,39,68,0.04)',
              border: '1px solid rgba(26,39,68,0.15)',
              borderLeft: '3px solid #1e7e34',
              borderRadius: 5, padding: '10px 14px',
            }}>
              <div style={{ fontFamily: 'Orbitron', fontSize: '0.7rem', color: '#1e7e34', fontWeight: 700, marginBottom: 6 }}>
                🤖 AI DETECTED — {activeTab} DIRECTION
              </div>
              <DetectionCounts counts={detection.counts} />
              <div style={{ marginTop: 8, display: 'flex', gap: 16, fontFamily: 'Rajdhani', fontSize: '0.9rem', color: '#78716c' }}>
                <span>PCU: <strong style={{ color: '#1a2744' }}>{detection.total_pcu}</strong></span>
                <span>Density: <strong style={{ color: getDensityColor(detection.density / 100) }}>{detection.density}%</strong></span>
                <span>Level: <strong style={{ color: '#1a2744' }}>{detection.congestion_level.toUpperCase()}</strong></span>
              </div>
              <ModelBadge info={detection.model_info} />
              {detection.annotated_image && (
                <img
                  src={detection.annotated_image}
                  alt="Annotated detection"
                  style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200, borderRadius: 4, objectFit: 'contain' }}
                />
              )}
              <button
                onClick={() => applyDetectionCounts(detection)}
                style={{
                  marginTop: 8, background: '#1a2744', color: '#fff',
                  border: 'none', borderRadius: 4, padding: '6px 14px',
                  fontFamily: 'Orbitron', fontSize: '0.7rem', cursor: 'pointer',
                  letterSpacing: 1,
                }}
              >
                ↓ APPLY COUNTS TO TABLE
              </button>
            </div>
          )}

          {/* Vehicle table — includes Indian types */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Rajdhani' }}>
              <thead>
                <tr style={{ background: '#f0ebe0' }}>
                  {['Vehicle Type', 'Count', 'PCU Weight', 'PCU Value'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left',
                      fontFamily: 'Orbitron', fontSize: '0.65rem', fontWeight: 700,
                      color: '#78716c', letterSpacing: 1,
                      borderBottom: '2px solid rgba(26,39,68,0.15)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VEHICLE_TYPES.map((vt, idx) => {
                  const count    = (vehicleInputs[activeTab][vt.key] as number) || 0;
                  const pcuValue = count * vt.pcu;
                  return (
                    <tr key={vt.key} style={{
                      background: idx % 2 === 0 ? '#faf7f2' : '#f5f0e8',
                      borderBottom: '1px solid rgba(26,39,68,0.07)',
                    }}>
                      <td style={{ padding: '7px 12px', color: '#1c1917', fontWeight: 600 }}>
                        {vt.icon} {vt.label}
                        {vt.indian && (
                          <span style={{
                            marginLeft: 6, fontSize: '0.65rem',
                            background: 'rgba(200,150,12,0.15)', color: '#b45309',
                            borderRadius: 3, padding: '1px 5px', fontFamily: 'Orbitron',
                          }}>IN</span>
                        )}
                      </td>
                      <td style={{ padding: '7px 12px' }}>
                        <input
                          type="number" min={0} className="vehicle-input"
                          value={count}
                          onChange={e => handleVehicleChange(activeTab, vt.key, e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '7px 12px', color: '#78716c' }}>{vt.pcu.toFixed(2)}</td>
                      <td style={{ padding: '7px 12px', color: '#1a2744', fontWeight: 700 }}>
                        {pcuValue.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Live PCU density bar */}
          <div style={{ background: '#f0ebe0', border: '1px solid rgba(26,39,68,0.15)', borderRadius: 5, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Rajdhani', color: '#78716c', fontWeight: 600 }}>
                Total PCU — {activeTab}:
              </span>
              <span style={{ fontFamily: 'Orbitron', color: '#1a2744', fontWeight: 700, fontSize: '0.9rem' }}>
                {currentDirPCU.toFixed(1)}
              </span>
            </div>
            <div className="density-bar-container">
              <div className="density-bar-fill" style={{
                width: `${Math.min(100, Math.max(0, currentDensity * 100)).toFixed(1)}%`,
                background: `linear-gradient(90deg, ${densityColor}cc, ${densityColor})`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontFamily: 'Rajdhani', fontSize: '0.85rem', color: '#78716c' }}>
                Density: {(currentDensity * 100).toFixed(1)}%
              </span>
              <span style={{ fontFamily: 'Orbitron', fontSize: '0.68rem', fontWeight: 700, color: densityColor, letterSpacing: 1 }}>
                {getCongestionLabel(currentDensity)}
              </span>
            </div>
          </div>

          {/* Optimize button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <button className="btn-optimize" onClick={handleOptimize}>
              ⚡ OPTIMIZE ALL SIGNALS
            </button>
          </div>

          {/* Optimization results */}
          {optimizationResult && (
            <div className="panel panel-result animate-fade-in" style={{ padding: '16px', marginTop: 4 }}>
              <SectionTitle icon="📊" text="Optimization Results" accent="#1e7e34" />

              <div style={{ height: 190, marginTop: 12, marginBottom: 14 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,39,68,0.1)" />
                    <XAxis dataKey="direction" tick={{ fill: '#78716c', fontFamily: 'Orbitron', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#78716c', fontFamily: 'Rajdhani', fontSize: 11 }} />
                    <Tooltip contentStyle={{
                      background: '#faf7f2', border: '1px solid rgba(26,39,68,0.2)',
                      borderTop: '3px solid #1a2744', borderRadius: 5,
                      fontFamily: 'Rajdhani', color: '#1c1917',
                      boxShadow: '0 4px 12px rgba(26,39,68,0.15)',
                    }} />
                    <Legend wrapperStyle={{ fontFamily: 'Rajdhani', color: '#78716c', fontSize: 13 }} />
                    <Bar dataKey="Old Green" fill="#ea580c" opacity={0.75} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="New Green" fill="#1a2744" opacity={0.9}  radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {DIRECTIONS.map(dir => {
                  const oldG = optimizationResult.oldTimers.find(t => t.direction === dir)?.green_time ?? 25;
                  const newG = optimizationResult.newTimers.find(t => t.direction === dir)?.green_time ?? 25;
                  const diff = newG - oldG;
                  const up   = diff > 0;
                  const down = diff < 0;
                  return (
                    <div key={dir} style={{
                      background: '#faf7f2', border: '1px solid rgba(26,39,68,0.12)',
                      borderTop: `3px solid ${up ? '#16a34a' : down ? '#dc2626' : '#78716c'}`,
                      borderRadius: 5, padding: '10px 14px',
                    }}>
                      <div style={{ fontFamily: 'Orbitron', fontSize: '0.7rem', color: '#1a2744', marginBottom: 6, fontWeight: 700 }}>
                        {dir} — {getRoadName(dir).split(' ').slice(0, 3).join(' ')}
                      </div>
                      <div style={{ fontFamily: 'Rajdhani', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#ea580c', fontWeight: 600 }}>{oldG}s</span>
                        <span style={{ color: '#78716c' }}>→</span>
                        <span style={{ color: '#1a2744', fontWeight: 700 }}>{newG}s</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: up ? '#15803d' : down ? '#b91c1c' : '#78716c' }}>
                          {up ? `▲ +${diff}s` : down ? `▼ ${diff}s` : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submission history */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#78716c', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
              Submission History
            </div>
            {optimizationResult ? (
              <div style={{
                background: '#faf7f2', border: '1px solid rgba(26,39,68,0.12)',
                borderLeft: '3px solid #1e7e34', borderRadius: 5, padding: '10px 14px',
                fontFamily: 'Rajdhani', fontSize: '0.9rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c' }}>
                  <span>Latest optimization</span>
                  <span style={{ color: '#1a2744', fontFamily: 'Orbitron', fontSize: '0.78rem' }}>
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ marginTop: 5, color: '#15803d', fontWeight: 600 }}>
                  ✅ AI recalculated {optimizationResult.newTimers.length} signal timers
                </div>
              </div>
            ) : (
              <div style={{
                color: '#78716c', fontFamily: 'Rajdhani', fontSize: '0.9rem',
                padding: '10px 14px', background: '#faf7f2',
                border: '1px solid rgba(26,39,68,0.08)', borderRadius: 5,
              }}>
                No optimizations yet — enter vehicle counts and click Optimize.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
