import { Queue, FlowProducer, type ConnectionOptions } from 'bullmq';
import { logger } from '../common/utils/logger.js';
import { QUEUES, type QueueName } from './queue.types.js';

export class QueueManager {
  private readonly queues = new Map<QueueName, Queue>();
  private flowProducer: FlowProducer | null = null;

  constructor(private readonly connection: ConnectionOptions) {}

  async initialize(): Promise<void> {
    for (const queueName of Object.values(QUEUES)) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      });
      this.queues.set(queueName, queue);
      logger.info({ queueName }, 'Queue created');
    }

    this.flowProducer = new FlowProducer({
      connection: this.connection,
    });

    logger.info('FlowProducer initialized');
  }

  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue "${name}" not found — was initialize() called?`);
    }
    return queue;
  }

  getFlowProducer(): FlowProducer {
    if (!this.flowProducer) {
      throw new Error('FlowProducer not initialized — was initialize() called?');
    }
    return this.flowProducer;
  }

  async pauseQueue(name: QueueName): Promise<void> {
    const queue = this.getQueue(name);
    await queue.pause();
    logger.info({ queueName: name }, 'Queue paused');
  }

  async resumeQueue(name: QueueName): Promise<void> {
    const queue = this.getQueue(name);
    await queue.resume();
    logger.info({ queueName: name }, 'Queue resumed');
  }

  async obliterateQueue(name: QueueName): Promise<void> {
    const queue = this.getQueue(name);
    await queue.obliterate({ force: true });
    logger.info({ queueName: name }, 'Queue obliterated');
  }

  async shutdown(): Promise<void> {
    if (this.flowProducer) {
      await this.flowProducer.close();
      logger.info('FlowProducer closed');
    }

    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info({ queueName: name }, 'Queue closed');
    }

    this.queues.clear();
    this.flowProducer = null;
  }
}
