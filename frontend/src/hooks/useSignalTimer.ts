import { useState, useEffect, useRef } from 'react';
import { SignalTimer, SignalPhase } from '../types';

export interface DirectionSignalState {
  phase: SignalPhase;
  countdown: number;
}

type SignalRecord = Record<string, DirectionSignalState>;

const DIRECTIONS = ['N', 'S', 'E', 'W'];

export function useSignalTimer(timers: SignalTimer[]): SignalRecord {
  const [signals, setSignals] = useState<SignalRecord>(() => {
    const initial: SignalRecord = {};
    DIRECTIONS.forEach((dir) => {
      initial[dir] = { phase: 'red', countdown: 30 };
    });
    return initial;
  });

  // Track current state in refs to avoid stale closures
  const activeDirectionIndexRef = useRef(0);
  const currentPhaseRef = useRef<SignalPhase>('green');
  const countdownRef = useRef(0);
  const timersRef = useRef(timers);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  useEffect(() => {
    if (!timers || timers.length === 0) return;

    // Reset to start state
    activeDirectionIndexRef.current = 0;
    currentPhaseRef.current = 'green';

    const getTimer = (dir: string): SignalTimer => {
      const found = timersRef.current.find((t) => t.direction === dir);
      return found || { id: 0, junction_id: 0, direction: dir, green_time: 30, yellow_time: 5, red_time: 90 };
    };

    const activeDir = DIRECTIONS[0];
    const activeTimer = getTimer(activeDir);
    countdownRef.current = activeTimer.green_time;

    // Initialize all signals: active=green, others=red
    const buildState = (activeIndex: number, phase: SignalPhase, countdown: number): SignalRecord => {
      const state: SignalRecord = {};
      DIRECTIONS.forEach((dir, i) => {
        if (i === activeIndex) {
          state[dir] = { phase, countdown };
        } else {
          // Calculate red countdown for waiting directions
          const myTimer = getTimer(dir);
          state[dir] = { phase: 'red', countdown: myTimer.red_time };
        }
      });
      return state;
    };

    setSignals(buildState(0, 'green', activeTimer.green_time));

    const intervalId = setInterval(() => {
      const activeIndex = activeDirectionIndexRef.current;
      const activeDirection = DIRECTIONS[activeIndex];
      const activeTimerData = getTimer(activeDirection);

      countdownRef.current = Math.max(0, countdownRef.current - 1);
      const newCountdown = countdownRef.current;

      if (newCountdown === 0) {
        // Phase transition
        if (currentPhaseRef.current === 'green') {
          currentPhaseRef.current = 'yellow';
          countdownRef.current = activeTimerData.yellow_time;
        } else if (currentPhaseRef.current === 'yellow') {
          // Move to next direction
          const nextIndex = (activeIndex + 1) % DIRECTIONS.length;
          activeDirectionIndexRef.current = nextIndex;
          currentPhaseRef.current = 'green';
          const nextDir = DIRECTIONS[nextIndex];
          const nextTimer = getTimer(nextDir);
          countdownRef.current = nextTimer.green_time;
        }
      }

      const currentActiveDir = DIRECTIONS[activeDirectionIndexRef.current];
      const currentPhase = currentPhaseRef.current;
      const currentCountdown = countdownRef.current;

      setSignals((prev) => {
        const newState: SignalRecord = { ...prev };
        DIRECTIONS.forEach((dir) => {
          if (dir === currentActiveDir) {
            newState[dir] = { phase: currentPhase, countdown: Math.max(0, currentCountdown) };
          } else {
            // Keep existing red countdown but tick it down too
            const existing = prev[dir];
            if (existing && existing.phase === 'red') {
              newState[dir] = {
                phase: 'red',
                countdown: Math.max(0, existing.countdown - 1),
              };
            } else {
              newState[dir] = { phase: 'red', countdown: Math.max(0, getTimer(dir).red_time) };
            }
          }
        });
        return newState;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timers]);

  return signals;
}
