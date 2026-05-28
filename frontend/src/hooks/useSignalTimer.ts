import { useState, useEffect, useRef } from 'react';
import { SignalTimer, SignalPhase } from '../types';

export interface DirectionSignalState {
  phase: SignalPhase;
  countdown: number;
}

type SignalRecord = Record<string, DirectionSignalState>;

const DIRECTIONS = ['N', 'S', 'E', 'W'];

/**
 * Drives a 4-direction traffic signal through a strict N→S→E→W→N cycle.
 *
 * Each direction runs its full green_time then yellow_time before the next
 * direction starts. The total cycle is always:
 *   sum of (green_time + yellow_time) across all 4 directions = 120 s
 *
 * Red countdown for waiting directions counts down to 0 exactly when that
 * direction goes green, so the display is always accurate.
 *
 * New timer values are picked up on the next phase transition (no mid-cycle
 * restart) unless the timer list itself changes length or composition.
 */
export function useSignalTimer(timers: SignalTimer[]): SignalRecord {
  const [signals, setSignals] = useState<SignalRecord>(() => {
    const init: SignalRecord = {};
    DIRECTIONS.forEach((d) => { init[d] = { phase: 'red', countdown: 30 }; });
    return init;
  });

  // Refs survive re-renders without triggering effects
  const activeIndexRef = useRef(0);
  const phaseRef       = useRef<SignalPhase>('green');
  const countdownRef   = useRef(0);
  const timersRef      = useRef<SignalTimer[]>(timers);

  // Keep timersRef current so the interval always reads latest values
  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  // Stable key: re-start the cycle only when actual green times change
  // (e.g. after the user submits new vehicle counts), not on every poll.
  const timersKey = timers.map((t) => `${t.direction}:${t.green_time}`).join('|');

  useEffect(() => {
    if (!timers || timers.length === 0) return;

    /** Always reads from timersRef so new values apply on the next transition */
    const getTimer = (dir: string): SignalTimer =>
      timersRef.current.find((t) => t.direction === dir) ??
      { id: 0, junction_id: 0, direction: dir, green_time: 25, yellow_time: 5, red_time: 90 };

    // ── Initialise from N ────────────────────────────────────────────────
    activeIndexRef.current = 0;
    phaseRef.current       = 'green';
    countdownRef.current   = getTimer(DIRECTIONS[0]).green_time;

    /**
     * Build the starting state:
     * – N is green  (countdown = its green_time)
     * – S/E/W are red with countdown = seconds until their green phase starts
     *   (i.e. the cumulative sum of (green+yellow) of all preceding directions)
     */
    const buildInitialState = (): SignalRecord => {
      const state: SignalRecord = {};
      let waitTime = 0;
      DIRECTIONS.forEach((dir, i) => {
        const t = getTimer(dir);
        if (i === 0) {
          state[dir] = { phase: 'green', countdown: t.green_time };
        } else {
          state[dir] = { phase: 'red', countdown: waitTime };
        }
        // Accumulate this direction's full phase for the next direction's wait
        waitTime += t.green_time + t.yellow_time;
      });
      return state;
    };

    setSignals(buildInitialState());

    // ── 1-second tick ────────────────────────────────────────────────────
    const intervalId = setInterval(() => {
      // Decrement the active direction's phase countdown
      countdownRef.current = Math.max(0, countdownRef.current - 1);

      let justBecameRedDir: string | null = null;

      if (countdownRef.current === 0) {
        const activeDir   = DIRECTIONS[activeIndexRef.current];
        const activeTimer = getTimer(activeDir);

        if (phaseRef.current === 'green') {
          // Green phase done → yellow
          phaseRef.current   = 'yellow';
          countdownRef.current = activeTimer.yellow_time;
        } else {
          // Yellow phase done → next direction goes green
          justBecameRedDir = activeDir; // this direction's phase is over
          const nextIndex  = (activeIndexRef.current + 1) % DIRECTIONS.length;
          activeIndexRef.current = nextIndex;
          phaseRef.current       = 'green';
          countdownRef.current   = getTimer(DIRECTIONS[nextIndex]).green_time;
        }
      }

      // Snapshot values for the state update closure
      const activeIndex = activeIndexRef.current;
      const phase       = phaseRef.current;
      const countdown   = countdownRef.current;
      const justRed     = justBecameRedDir;

      setSignals((prev) => {
        const next: SignalRecord = {};
        DIRECTIONS.forEach((dir, i) => {
          if (i === activeIndex) {
            // Active direction: show current phase & countdown
            next[dir] = { phase, countdown };
          } else if (dir === justRed) {
            // This direction just completed its cycle; reset to full red wait
            next[dir] = { phase: 'red', countdown: getTimer(dir).red_time };
          } else {
            // Waiting direction: tick its countdown down by 1
            next[dir] = {
              phase: 'red',
              countdown: Math.max(0, (prev[dir]?.countdown ?? 0) - 1),
            };
          }
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timersKey]);

  return signals;
}
