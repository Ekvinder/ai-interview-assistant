/**
 * Global type augmentation for Mongoose connection caching.
 * Required to persist the connection across hot-reloads in Next.js dev mode.
 * Without this, each hot-reload creates a new connection, exhausting the pool.
 */
import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: typeof import("mongoose") | null;
    promise: Promise<typeof import("mongoose")> | null;
  };
}

export {};
