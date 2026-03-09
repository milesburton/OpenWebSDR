/**
 * test-harness — integration test orchestrator.
 *
 * Starts services in a controlled manner, runs integration tests,
 * and reports results. Designed to run against a live Docker Compose stack.
 */

export * from './harness';
export * from './wait';
