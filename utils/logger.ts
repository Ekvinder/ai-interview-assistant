/**
 * Centralized logger utility for consistent logging formatting.
 */
export const logger = {
  info: (message: string, meta?: unknown) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? meta : '');
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? meta : '');
  },
  error: (message: string, meta?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta ? meta : '');
  },
};
