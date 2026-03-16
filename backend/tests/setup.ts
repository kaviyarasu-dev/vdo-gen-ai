import { existsSync, mkdirSync } from 'node:fs';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Set test environment variables before any module import
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-at-least-32-chars';
process.env.MONGODB_URI = 'mongodb://localhost:27017'; // Will be overridden
process.env.MONGODB_DB_NAME = 'vdo_gen_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.LOG_LEVEL = 'silent';

// Each fork needs its own dbPath to avoid lock conflicts
const baseDir = process.env.TMPDIR ?? '/tmp/claude';
const dbPath = `${baseDir}/mongod-${process.pid}`;
if (!existsSync(dbPath)) {
  mkdirSync(dbPath, { recursive: true });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      port: 0,
      dbPath,
      args: ['--nounixsocket'],
    },
    binary: {
      systemBinary: '/opt/homebrew/bin/mongod',
    },
  });
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;

  await mongoose.connect(mongoUri, { dbName: 'vdo_gen_test' });
});

afterEach(async () => {
  // Clean all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
