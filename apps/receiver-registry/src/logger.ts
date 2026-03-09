export interface Logger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(
  level: 'debug' | 'info' | 'warn' | 'error',
  serviceName: string,
): Logger {
  // Dynamic import avoids breaking non-node environments in tests
  // In production, pino is always available
  const pino = require('pino') as typeof import('pino');
  return pino.default({
    level,
    base: { service: serviceName },
  });
}
