import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = global as { mongoose?: MongooseCache };

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

// After the guard above, mongoose is guaranteed to be set.
const cached = globalWithMongoose.mongoose as MongooseCache;

export async function connectToDatabase() {
  if (cached.conn?.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,          // cap connection pool (default is 100)
      minPoolSize: 2,           // keep 2 connections warm
      serverSelectionTimeoutMS: 5000,  // fail fast if mongo is unreachable
      socketTimeoutMS: 45000,   // close idle sockets after 45 s
      connectTimeoutMS: 10000,  // TCP connection timeout
    };

    cached.promise = (async () => {
      try {
        const mongooseInstance = await mongoose.connect(MONGODB_URI, opts);
        cached.conn = mongooseInstance;
        return mongooseInstance;
      } catch (error) {
        cached.conn = null;
        cached.promise = null;
        throw error;
      }
    })();
  }

  try {
    return await cached.promise;
  } catch (error) {
    cached.conn = null;
    cached.promise = null;
    throw error;
  }
}
