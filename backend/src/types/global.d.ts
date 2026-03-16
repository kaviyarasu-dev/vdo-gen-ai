declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string | undefined;
    PORT: string | undefined;
    HOST: string | undefined;
    MONGODB_URI: string | undefined;
    MONGODB_DB_NAME: string | undefined;
    REDIS_HOST: string | undefined;
    REDIS_PORT: string | undefined;
    JWT_ACCESS_SECRET: string | undefined;
    JWT_REFRESH_SECRET: string | undefined;
    JWT_ACCESS_EXPIRES_IN: string | undefined;
    JWT_REFRESH_EXPIRES_IN: string | undefined;
    RATE_LIMIT_MAX: string | undefined;
    RATE_LIMIT_WINDOW: string | undefined;
  }
}
