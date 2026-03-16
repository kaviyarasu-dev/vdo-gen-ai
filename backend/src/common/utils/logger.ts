import pino from 'pino';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

const LOG_LEVELS: Record<string, string> = {
  development: 'debug',
  production: 'info',
  test: 'silent',
};

const logLevel = LOG_LEVELS[NODE_ENV] ?? 'info';

const isDevelopment = NODE_ENV === 'development';

export const logger = pino({
  level: logLevel,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
});
