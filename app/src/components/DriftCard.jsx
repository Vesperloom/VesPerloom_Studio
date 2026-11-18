import React from 'react';
import { GitFork, ArrowUpRight } from 'lucide-react';
/** A contour plot of interpolated seed paths, rendered as a tiny vector plate. */
function Trajectories() {
  return (
    <svg viewBox="0 0 99 84" fill="none" aria-hidden="true" className="drift-plot">
      {Array.from({ length: 14 }, (_, i) => (
        <path
          key={i}
          d={`M -3 ${18 + i * 3.3} C ${18 + i * 1.4} ${-14 + i * 2.4}, ${47 - i * 1.2} ${-6 + i * 7.7}, ${59 + i * 0.5} ${34 + i * 2.1} S 91 ${80 - i * 1.8}, 107 ${55 - i * 2.8}`}
          stroke="currentColor"
          strokeWidth=".85"
        />
      ))}
    </svg>
  );
}
export function DriftCard({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="drift-card"
      onClick={onClick}
      disabled={disabled}
      aria-label="Explore seed drift"
    >
      <div className="drift-copy">
        <span>
          <GitFork size={11} /> SEED LAB
        </span>
        <b>
          Explore seed drift <ArrowUpRight size={14} />
        </b>
        <small>Branch a composition from its root seed.</small>
      </div>
      <Trajectories />
    </button>
  );
}
