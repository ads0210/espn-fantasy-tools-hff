/**
 * Client half of the dataset coordinator.
 *
 * Deliberately its own module with no imports. The refresh engine needs to ask
 * the coordinator to refresh a *different* dataset — a digest cannot be built
 * without the identity payload it joins against — and the coordinator imports
 * the refresh engine. Keeping these three functions here means refresh.js and
 * coordinator.js never import each other, so there is no module cycle to reason
 * about at bundle time.
 */

/** Ask the coordinator for this dataset key to refresh, and return its report. */
export async function coordinatorRefresh(env, key, force) {
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(key));
  const res = await stub.fetch(
    `https://coordinator/refresh?key=${encodeURIComponent(key)}${force ? '&force=1' : ''}`
  );
  try {
    return await res.json();
  } catch {
    return { ok: false, error: `coordinator returned ${res.status}` };
  }
}

export async function coordinatorCounters(env, key) {
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(key));
  const res = await stub.fetch('https://coordinator/counters');
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function coordinatorReset(env, key) {
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(key));
  await stub.fetch('https://coordinator/reset');
}
