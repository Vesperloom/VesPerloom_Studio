/** Platform-neutral dense epsilon predictor; shared by Node and browser workers. */
export function predict(input, layers) {
  let x = input;
  for (const [k, { input: ni, output: no, values: w }] of layers.entries()) {
    const y = Float64Array.from(w.subarray(ni * no));
    for (let i = 0; i < ni; i++) for (let j = 0; j < no; j++) y[j] += x[i] * w[i * no + j];
    if (k + 1 < layers.length) for (let j = 0; j < no; j++) y[j] /= 1 + Math.exp(-y[j]);
    x = y;
  }
  return x;
}
