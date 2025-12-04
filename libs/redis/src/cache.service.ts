import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheOptions {
  ttl?: number; // TTL in seconds
  prefix?: string;
}

@Injectable()
export class CacheService {
  private readonly CACHE_PREFIX = 'cache:';
  private readonly TOKEN_PREFIX = 'cache:token:';
  private readonly ROOM_PREFIX = 'cache:room:';
  private readonly DEFAULT_TTL = 300; // 5분

  constructor(private readonly redis: RedisService) {}

  // ==================== 일반 캐싱 ====================

  /**
   * 캐시에 값 저장
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    const cacheKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttl || this.DEFAULT_TTL;
    await this.redis.setJson(cacheKey, value, ttl);
  }

  /**
   * 캐시에서 값 조회
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    const cacheKey = this.buildKey(key, prefix);
    return this.redis.getJson<T>(cacheKey);
  }

  /**
   * 캐시 삭제
   */
  async del(key: string, prefix?: string): Promise<boolean> {
    const cacheKey = this.buildKey(key, prefix);
    const result = await this.redis.del(cacheKey);
    return result > 0;
  }

  /**
   * 캐시 존재 여부 확인
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    const cacheKey = this.buildKey(key, prefix);
    return this.redis.exists(cacheKey);
  }

  /**
   * 캐시 또는 팩토리 실행 (Cache-Aside 패턴)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key, options?.prefix);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  // ==================== 토큰 캐싱 ====================

  /**
   * 토큰 캐싱 (짧은 TTL)
   */
  async cacheToken(
    roomName: string,
    identity: string,
    token: string,
    ttlSeconds: number = 60, // 1분
  ): Promise<void> {
    const key = `${this.TOKEN_PREFIX}${roomName}:${identity}`;
    await this.redis.set(key, token, ttlSeconds);
  }

  /**
   * 캐시된 토큰 조회
   */
  async getCachedToken(
    roomName: string,
    identity: string,
  ): Promise<string | null> {
    const key = `${this.TOKEN_PREFIX}${roomName}:${identity}`;
    return this.redis.get(key);
  }

  /**
   * 토큰 캐시 무효화
   */
  async invalidateToken(roomName: string, identity: string): Promise<void> {
    const key = `${this.TOKEN_PREFIX}${roomName}:${identity}`;
    await this.redis.del(key);
  }

  /**
   * 방의 모든 토큰 캐시 무효화
   */
  async invalidateRoomTokens(roomName: string): Promise<void> {
    const pattern = `${this.TOKEN_PREFIX}${roomName}:*`;
    const keys = await this.redis.keys(pattern);
    for (const key of keys) {
      await this.redis.del(key);
    }
  }

  // ==================== Room 캐싱 ====================

  /**
   * Room 정보 캐싱
   */
  async cacheRoom<T>(
    roomName: string,
    data: T,
    ttlSeconds: number = 300, // 5분
  ): Promise<void> {
    const key = `${this.ROOM_PREFIX}${roomName}`;
    await this.redis.setJson(key, data, ttlSeconds);
  }

  /**
   * 캐시된 Room 정보 조회
   */
  async getCachedRoom<T>(roomName: string): Promise<T | null> {
    const key = `${this.ROOM_PREFIX}${roomName}`;
    return this.redis.getJson<T>(key);
  }

  /**
   * Room 캐시 무효화
   */
  async invalidateRoom(roomName: string): Promise<void> {
    const key = `${this.ROOM_PREFIX}${roomName}`;
    await this.redis.del(key);
  }

  /**
   * Room 목록 캐싱
   */
  async cacheRoomList<T>(
    rooms: T[],
    ttlSeconds: number = 30, // 30초
  ): Promise<void> {
    const key = `${this.ROOM_PREFIX}list`;
    await this.redis.setJson(key, rooms, ttlSeconds);
  }

  /**
   * 캐시된 Room 목록 조회
   */
  async getCachedRoomList<T>(): Promise<T[] | null> {
    const key = `${this.ROOM_PREFIX}list`;
    return this.redis.getJson<T[]>(key);
  }

  /**
   * Room 목록 캐시 무효화
   */
  async invalidateRoomList(): Promise<void> {
    const key = `${this.ROOM_PREFIX}list`;
    await this.redis.del(key);
  }

  // ==================== Rate Limiting ====================

  /**
   * Rate Limit 체크 (Sliding Window)
   */
  async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // 현재 윈도우 내 요청 수 증가
    const count = await this.redis.incr(key);

    // 첫 요청이면 TTL 설정
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    const ttl = await this.redis.ttl(key);
    const resetAt = now + ttl * 1000;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }

  // ==================== 헬퍼 ====================

  private buildKey(key: string, prefix?: string): string {
    const p = prefix || this.CACHE_PREFIX;
    return `${p}${key}`;
  }

  /**
   * 패턴으로 캐시 일괄 삭제
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(`${this.CACHE_PREFIX}${pattern}`);
    let deleted = 0;
    for (const key of keys) {
      await this.redis.del(key);
      deleted++;
    }
    return deleted;
  }
}
