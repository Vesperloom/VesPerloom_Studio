/** Continuous world-space trajectories. Phase zero preserves the root composition. */
export function cameraAt(track, t, strength) {
  const k = strength / 100;
  const u = t * t * (3 - 2 * t);
  if (track === 'dolly')
    return { x: 0, z: 3.6 * u * k, lift: 0.13 * u * k, yaw: 0, sky: 0.06 * u * k, time: t * k };
  if (track === 'arc')
    return {
      x: 2.25 * Math.sin(Math.PI * u) * k,
      z: 2.2 * u * k,
      lift: 0.35 * Math.sin(Math.PI * u) * k,
      yaw: -0.095 * Math.sin(Math.PI * u) * k,
      sky: 0.16 * u * k,
      time: t * k,
    };
  return {
    x: 3.5 * u * k,
    z: 0.6 * u * k,
    lift: 0.1 * Math.sin(Math.PI * u) * k,
    yaw: -0.045 * u * k,
    sky: 0.12 * u * k,
    time: t * k,
  };
}
