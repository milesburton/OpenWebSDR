export async function waitForUrl(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number; expectedStatus?: number } = {},
): Promise<void> {
  const { timeoutMs = 30_000, intervalMs = 500, expectedStatus = 200 } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.status === expectedStatus) return;
    } catch {
      // Service not yet available
    }
    await sleep(intervalMs);
  }

  throw new Error(`Service at ${url} did not become ready within ${timeoutMs}ms`);
}

export async function waitForAllServices(
  services: Array<{ name: string; url: string }>,
  timeoutMs = 60_000,
): Promise<void> {
  await Promise.all(
    services.map(({ name, url }) =>
      waitForUrl(url, { timeoutMs }).catch((err: unknown) => {
        throw new Error(
          `Service "${name}" failed readiness check: ${err instanceof Error ? err.message : String(err)}`,
        );
      }),
    ),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
