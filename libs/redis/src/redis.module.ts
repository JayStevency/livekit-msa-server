import { Module, DynamicModule, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { SessionService } from './session.service';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './constants';

const logger = new Logger('RedisModule');

// Handle both ESM and CommonJS imports
const RedisClient = (Redis as any).default || Redis;

export { REDIS_CLIENT };

export interface RedisModuleOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

@Global()
@Module({})
export class RedisModule {
  static forRoot(options?: RedisModuleOptions): DynamicModule {
    const redisProvider = {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const host = options?.host || 'localhost';
        const port = options?.port || 6379;
        logger.log(`Connecting to Redis at ${host}:${port}`);
        const client = new RedisClient({
          host,
          port,
          password: options?.password,
          db: options?.db || 0,
          lazyConnect: true,
        });
        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err: Error) => logger.error(`Redis error: ${err.message}`));
        return client;
      },
    };

    return {
      module: RedisModule,
      providers: [redisProvider, RedisService, SessionService, CacheService],
      exports: [REDIS_CLIENT, RedisService, SessionService, CacheService],
    };
  }

  static forRootAsync(): DynamicModule {
    const redisProvider = {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD');
        const db = configService.get<number>('REDIS_DB', 0);

        logger.log(`Connecting to Redis at ${host}:${port}`);
        const client = new RedisClient({
          host,
          port,
          password,
          db,
          lazyConnect: true,
        });
        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err: Error) => logger.error(`Redis error: ${err.message}`));
        return client;
      },
      inject: [ConfigService],
    };

    return {
      module: RedisModule,
      providers: [redisProvider, RedisService, SessionService, CacheService],
      exports: [REDIS_CLIENT, RedisService, SessionService, CacheService],
    };
  }
}
