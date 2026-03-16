import mongoose from 'mongoose';
import { logger } from '../common/utils/logger.js';

export async function connectDatabase(uri: string, dbName: string): Promise<typeof mongoose> {
  try {
    const connection = await mongoose.connect(uri, { dbName });

    logger.info({ dbName }, 'MongoDB connected successfully');

    mongoose.connection.on('error', (error: Error) => {
      logger.error({ err: error }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return connection;
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to connect to MongoDB');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}
