import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { useTrafficStore } from '../store/trafficStore';
import { Junction } from '../types';

const JAMSHEDPUR_CENTER: [number, number] = [22.8046, 86.2029];

const congestionConfig = {
  low:      { fill: '#16a34a', stroke: '#15803d', radius: 12, label: 'Low',      badge: 'badge-low'      },
  medium:   { fill: '#f59e0b', stroke: '#b45309', radius: 15, label: 'Medium',   badge: 'badge-medium'   },
  high:     { fill: '#ea580c', stroke: '#c2410c', radius: 18, label: 'High',     badge: 'badge-high'     },
  critical: { fill: '#dc2626', stroke: '#991b1b', radius: 22, label: 'Critical', badge: 'badge-critical' },
};

/* ── Live clock ─────────────────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{
        fontFamily: 'Orbitron',
        fontSize: '1.4rem',
        fontWeight: 700,
        color: '#e8edf8',
        letterSpacing: 2,
      }}>
        {time.toLocaleTimeString()}
      </div>
      <div style={{
        fontFamily: 'Rajdhani',
        fontSize: '0.8rem',
        color: '#8fa0c8',
        marginTop: 2,
      }}>
        {time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

/* ── Keep map view in sync ───────────────────────────────────────────────── */
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 13); }, [center, map]);
  return null;
}

/* ── Individual junction marker ─────────────────────────────────────────── */
function JunctionMarker({ junction, onClick }: { junction: Junction; onClick: (id: number) => void }) {
  const cfg = congestionConfig[junction.congestion_level];

  return (
    <>
      {/* Pulse halo */}
      <CircleMarker
        center={[junction.lat, junction.lng]}
        radius={cfg.radius + 7}
        fillColor={cfg.fill}
        fillOpacity={0.12}
        stroke={false}
        className="animate-pulse-ring"
      />
      {/* Main dot */}
      <CircleMarker
        center={[junction.lat, junction.lng]}
        radius={cfg.radius}
        fillColor={cfg.fill}
        fillOpacity={0.9}
        color={cfg.stroke}
        weight={2}
        eventHandlers={{ click: () => onClick(junction.id) }}
      >
        <Popup>
          <div style={{ fontFamily: 'Rajdhani', color: '#1c1917', minWidth: 170 }}>
            <div style={{
              fontFamily: 'Orbitron',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#1a2744',
              marginBottom: 4,
            }}>
              {junction.name}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#78716c', marginBottom: 8 }}>
              {junction.description}
            </div>
            <span className={`badge ${cfg.badge}`}>{cfg.label} Traffic</span>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#78716c' }}>
              Density: <strong>{(junction.congestion_density * 100).toFixed(0)}%</strong>
            </div>
            <div
              style={{ marginTop: 6, fontSize: '0.78rem', color: '#1a2744', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => onClick(junction.id)}
            >
              → Manage signals
            </div>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

/* ── Status count card ───────────────────────────────────────────────────── */
function StatusCard({
  count, label, color, borderColor,
}: { count: number; label: string; color: string; borderColor: string }) {
  return (
    <div style={{
      background: '#faf7f2',
      border: '1px solid rgba(28,25,23,0.1)',
      borderTop: `3px solid ${borderColor}`,
      borderRadius: 5,
      padding: '8px 12px',
      textAlign: 'center',
      minWidth: 56,
    }}>
      <div style={{
        fontFamily: 'Orbitron',
        fontSize: '1.4rem',
        fontWeight: 900,
        color,
        lineHeight: 1,
      }}>{count}</div>
      <div style={{
        fontFamily: 'Rajdhani',
        fontSize: '0.7rem',
        color: '#78716c',
        marginTop: 3,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>{label}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function MapPage() {
  const { junctions, loading, fetchJunctions } = useTrafficStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchJunctions();
    const id = setInterval(fetchJunctions, 5000);
    return () => clearInterval(id);
  }, [fetchJunctions]);

  const counts = {
    low:      junctions.filter(j => j.congestion_level === 'low').length,
    medium:   junctions.filter(j => j.congestion_level === 'medium').length,
    high:     junctions.filter(j => j.congestion_level === 'high').length,
    critical: junctions.filter(j => j.congestion_level === 'critical').length,
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0ebe0' }}>

      {/* ── Police Navy Header ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #111c36 0%, #1a2744 60%, #253460 100%)',
        borderBottom: '3px solid #c8960c',
        padding: '10px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        flexShrink: 0,
        boxShadow: '0 3px 12px rgba(17,28,54,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Badge stripe */}
          <div style={{
            width: 4,
            height: 40,
            background: 'linear-gradient(180deg, #c8960c, #e6b020, #c8960c)',
            borderRadius: 2,
            flexShrink: 0,
          }} />
          <div>
            <h1 style={{
              fontFamily: 'Orbitron',
              fontSize: '1.15rem',
              fontWeight: 900,
              color: '#f0e8d0',
              margin: 0,
              letterSpacing: 3,
            }}>
              🚦 JAMSHEDPUR TRAFFIC AI COMMAND
            </h1>
            <p style={{
              fontFamily: 'Rajdhani',
              fontSize: '0.78rem',
              color: '#8fa0c8',
              margin: '2px 0 0 0',
              letterSpacing: 1,
            }}>
              JHARKHAND URBAN TRAFFIC AUTHORITY  •  ADAPTIVE SIGNAL MANAGEMENT SYSTEM
            </p>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* ── Map Area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>

        {/* Loading state */}
        {loading && junctions.length === 0 ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f0ebe0', zIndex: 999,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52,
                border: '3px solid rgba(26,39,68,0.15)',
                borderTop: '3px solid #1a2744',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
                margin: '0 auto 14px',
              }} />
              <div style={{ fontFamily: 'Orbitron', color: '#1a2744', fontSize: '0.85rem', letterSpacing: 2 }}>
                LOADING TRAFFIC DATA...
              </div>
            </div>
          </div>
        ) : (
          <MapContainer
            center={JAMSHEDPUR_CENTER}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <MapUpdater center={JAMSHEDPUR_CENTER} />
            {/* Light CartoDB "Voyager" tile — suits the off-white theme */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={20}
            />
            {junctions.map(j => (
              <JunctionMarker
                key={j.id}
                junction={j}
                onClick={id => navigate(`/junction/${id}`)}
              />
            ))}
          </MapContainer>
        )}

        {/* ── Network Status — bottom-left ──────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 24, left: 24, zIndex: 1000,
          background: 'rgba(250,247,242,0.96)',
          border: '1px solid rgba(26,39,68,0.18)',
          borderTop: '3px solid #1a2744',
          borderRadius: 6,
          padding: '12px 16px',
          minWidth: 200,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(26,39,68,0.14)',
        }}>
          <div style={{
            fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#78716c',
            letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase',
          }}>
            Network Status
          </div>
          <div style={{
            fontFamily: 'Orbitron', fontSize: '1.05rem', color: '#1a2744',
            fontWeight: 700, marginBottom: 12,
          }}>
            {junctions.length} Junctions Active
          </div>

          {/* 4 status mini-cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <StatusCard count={counts.low}      label="Low"      color="#15803d" borderColor="#16a34a" />
            <StatusCard count={counts.medium}   label="Medium"   color="#b45309" borderColor="#f59e0b" />
            <StatusCard count={counts.high}     label="High"     color="#c2410c" borderColor="#ea580c" />
            <StatusCard count={counts.critical} label="Critical" color="#991b1b" borderColor="#dc2626" />
          </div>
        </div>

        {/* ── Legend — bottom-right ──────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 24, right: 24, zIndex: 1000,
          background: 'rgba(250,247,242,0.96)',
          border: '1px solid rgba(26,39,68,0.18)',
          borderTop: '3px solid #c8960c',
          borderRadius: 6,
          padding: '12px 16px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(26,39,68,0.14)',
        }}>
          <div style={{
            fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#78716c',
            letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase',
          }}>
            Congestion Legend
          </div>
          {(Object.entries(congestionConfig) as [keyof typeof congestionConfig, typeof congestionConfig[keyof typeof congestionConfig]][]).map(([level, cfg]) => (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: cfg.fill, border: `2px solid ${cfg.stroke}`,
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'Rajdhani', fontSize: '0.9rem', color: '#3d3527', fontWeight: 600 }}>
                {cfg.label}
              </span>
              <span style={{ fontFamily: 'Rajdhani', fontSize: '0.75rem', color: '#78716c', marginLeft: 'auto' }}>
                {level === 'low'      && '< 30%'}
                {level === 'medium'   && '30–60%'}
                {level === 'high'     && '60–85%'}
                {level === 'critical' && '> 85%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
