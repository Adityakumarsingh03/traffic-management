import React from 'react';
import { SignalPhase } from '../../types';
import './SignalLight.css';

interface SignalLightProps {
  direction: string;
  roadName: string;
  phase: SignalPhase;
  countdown: number;
  greenTime: number;
  isActive: boolean;
}

const directionLabel: Record<string, string> = {
  N: 'NORTH',
  S: 'SOUTH',
  E: 'EAST',
  W: 'WEST',
};

export const SignalLight: React.FC<SignalLightProps> = ({
  direction,
  roadName,
  phase,
  countdown,
  isActive,
}) => {
  const safeCountdown = Math.max(0, countdown);

  const getLightClass = (lightType: 'red' | 'amber' | 'green'): string => {
    if (lightType === 'red' && phase === 'red') return 'signal-light red-active';
    if (lightType === 'amber' && phase === 'yellow') return 'signal-light amber-active';
    if (lightType === 'green' && phase === 'green') return 'signal-light green-active';
    return 'signal-light inactive';
  };

  const getStatusLabel = (): string => {
    if (phase === 'green') return 'GO';
    if (phase === 'yellow') return 'SLOW';
    return 'WAIT';
  };

  const phaseClass = phase === 'yellow' ? 'amber-phase' : `${phase}-phase`;

  return (
    <div className="signal-wrapper">
      <span className="signal-direction-label">{directionLabel[direction] || direction}</span>
      <span className="signal-road-name" title={roadName}>{roadName}</span>

      <div className={`signal-housing ${isActive ? 'border-cyan-400' : ''}`}
           style={{ boxShadow: isActive ? '0 0 20px rgba(0,245,255,0.4)' : undefined }}>
        {/* Red light */}
        <div
          className={getLightClass('red')}
          style={{ position: 'relative' }}
        >
          {phase === 'red' && (
            <div
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                border: '2px solid rgba(255,0,0,0.5)',
                animation: 'pulse-ring 2s infinite',
              }}
            />
          )}
        </div>

        {/* Amber light */}
        <div className={getLightClass('amber')} />

        {/* Green light */}
        <div
          className={getLightClass('green')}
          style={{ position: 'relative' }}
        >
          {phase === 'green' && (
            <div
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                border: '2px solid rgba(0,255,0,0.5)',
                animation: 'pulse-ring 2s infinite',
              }}
            />
          )}
        </div>
      </div>

      <span className={`signal-countdown ${phaseClass}`}>{safeCountdown}s</span>
      <span className={`signal-status-label ${phaseClass}`}>{getStatusLabel()}</span>
    </div>
  );
};

export default SignalLight;
