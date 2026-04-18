/**
 * middleware/index.ts
 *
 * Barrel export for user-facing middleware factories.
 * The compose engine is deliberately excluded as it is an
 * internal implementation detail of the pipeline.
 */
export { bearerAuth } from './auth';
export { logger } from './logger';
export { validateResponse } from './validator';
