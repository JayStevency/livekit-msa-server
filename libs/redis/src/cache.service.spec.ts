import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

describe('CacheService', () => {
  let service: CacheService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('일반 캐싱', () => {
    it('set - 기본 TTL로 캐시 저장', async () => {
      const data = { name: 'test', value: 123 };

      await service.set('my-key', data);

      expect(redisService.setJson).toHaveBeenCalledWith(
        'cache:my-key',
        data,
        300, // DEFAULT_TTL
      );
    });

    it('set - 커스텀 TTL로 캐시 저장', async () => {
      const data = { name: 'test' };

      await service.set('my-key', data, { ttl: 60 });

      expect(redisService.setJson).toHaveBeenCalledWith(
        'cache:my-key',
        data,
        60,
      );
    });

    it('set - 커스텀 prefix로 캐시 저장', async () => {
      const data = { name: 'test' };

      await service.set('my-key', data, { prefix: 'custom:' });

      expect(redisService.setJson).toHaveBeenCalledWith(
        'custom:my-key',
        data,
        300,
      );
    });

    it('get - 캐시 조회', async () => {
      const cachedData = { name: 'test', value: 123 };
      redisService.getJson.mockResolvedValue(cachedData);

      const result = await service.get('my-key');

      expect(result).toEqual(cachedData);
      expect(redisService.getJson).toHaveBeenCalledWith('cache:my-key');
    });

    it('get - 캐시가 없는 경우', async () => {
      redisService.getJson.mockResolvedValue(null);

      const result = await service.get('my-key');

      expect(result).toBeNull();
    });

    it('get - 커스텀 prefix로 조회', async () => {
      redisService.getJson.mockResolvedValue({ data: 'test' });

      await service.get('my-key', 'custom:');

      expect(redisService.getJson).toHaveBeenCalledWith('custom:my-key');
    });

    it('del - 캐시 삭제', async () => {
      redisService.del.mockResolvedValue(1);

      const result = await service.del('my-key');

      expect(result).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith('cache:my-key');
    });

    it('del - 삭제할 캐시가 없는 경우', async () => {
      redisService.del.mockResolvedValue(0);

      const result = await service.del('my-key');

      expect(result).toBe(false);
    });

    it('exists - 캐시 존재 확인', async () => {
      redisService.exists.mockResolvedValue(true);

      const result = await service.exists('my-key');

      expect(result).toBe(true);
      expect(redisService.exists).toHaveBeenCalledWith('cache:my-key');
    });
  });

  describe('getOrSet (Cache-Aside 패턴)', () => {
    it('getOrSet - 캐시 히트', async () => {
      const cachedData = { name: 'cached' };
      redisService.getJson.mockResolvedValue(cachedData);
      const factory = jest.fn().mockResolvedValue({ name: 'fresh' });

      const result = await service.getOrSet('my-key', factory);

      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
      expect(redisService.setJson).not.toHaveBeenCalled();
    });

    it('getOrSet - 캐시 미스, 팩토리 실행', async () => {
      redisService.getJson.mockResolvedValue(null);
      const freshData = { name: 'fresh' };
      const factory = jest.fn().mockResolvedValue(freshData);

      const result = await service.getOrSet('my-key', factory);

      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalled();
      expect(redisService.setJson).toHaveBeenCalledWith(
        'cache:my-key',
        freshData,
        300,
      );
    });

    it('getOrSet - 커스텀 옵션', async () => {
      redisService.getJson.mockResolvedValue(null);
      const freshData = { name: 'fresh' };
      const factory = jest.fn().mockResolvedValue(freshData);

      await service.getOrSet('my-key', factory, { ttl: 60, prefix: 'custom:' });

      expect(redisService.getJson).toHaveBeenCalledWith('custom:my-key');
      expect(redisService.setJson).toHaveBeenCalledWith(
        'custom:my-key',
        freshData,
        60,
      );
    });
  });

  describe('토큰 캐싱', () => {
    const roomName = 'test-room';
    const identity = 'user-123';
    const token = 'jwt-token-xxx';

    it('cacheToken - 토큰 캐싱', async () => {
      await service.cacheToken(roomName, identity, token);

      expect(redisService.set).toHaveBeenCalledWith(
        `cache:token:${roomName}:${identity}`,
        token,
        60, // 기본 TTL
      );
    });

    it('cacheToken - 커스텀 TTL', async () => {
      await service.cacheToken(roomName, identity, token, 120);

      expect(redisService.set).toHaveBeenCalledWith(
        `cache:token:${roomName}:${identity}`,
        token,
        120,
      );
    });

    it('getCachedToken - 토큰 조회', async () => {
      redisService.get.mockResolvedValue(token);

      const result = await service.getCachedToken(roomName, identity);

      expect(result).toBe(token);
      expect(redisService.get).toHaveBeenCalledWith(
        `cache:token:${roomName}:${identity}`,
      );
    });

    it('getCachedToken - 토큰이 없는 경우', async () => {
      redisService.get.mockResolvedValue(null);

      const result = await service.getCachedToken(roomName, identity);

      expect(result).toBeNull();
    });

    it('invalidateToken - 토큰 무효화', async () => {
      await service.invalidateToken(roomName, identity);

      expect(redisService.del).toHaveBeenCalledWith(
        `cache:token:${roomName}:${identity}`,
      );
    });

    it('invalidateRoomTokens - 방의 모든 토큰 무효화', async () => {
      redisService.keys.mockResolvedValue([
        `cache:token:${roomName}:user1`,
        `cache:token:${roomName}:user2`,
      ]);

      await service.invalidateRoomTokens(roomName);

      expect(redisService.keys).toHaveBeenCalledWith(
        `cache:token:${roomName}:*`,
      );
      expect(redisService.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('Room 캐싱', () => {
    const roomName = 'test-room';
    const roomData = {
      name: roomName,
      numParticipants: 5,
      maxParticipants: 10,
    };

    it('cacheRoom - Room 정보 캐싱', async () => {
      await service.cacheRoom(roomName, roomData);

      expect(redisService.setJson).toHaveBeenCalledWith(
        `cache:room:${roomName}`,
        roomData,
        300, // 기본 TTL
      );
    });

    it('cacheRoom - 커스텀 TTL', async () => {
      await service.cacheRoom(roomName, roomData, 60);

      expect(redisService.setJson).toHaveBeenCalledWith(
        `cache:room:${roomName}`,
        roomData,
        60,
      );
    });

    it('getCachedRoom - Room 정보 조회', async () => {
      redisService.getJson.mockResolvedValue(roomData);

      const result = await service.getCachedRoom(roomName);

      expect(result).toEqual(roomData);
      expect(redisService.getJson).toHaveBeenCalledWith(
        `cache:room:${roomName}`,
      );
    });

    it('invalidateRoom - Room 캐시 무효화', async () => {
      await service.invalidateRoom(roomName);

      expect(redisService.del).toHaveBeenCalledWith(`cache:room:${roomName}`);
    });

    it('cacheRoomList - Room 목록 캐싱', async () => {
      const roomList = [roomData, { name: 'room2', numParticipants: 3 }];

      await service.cacheRoomList(roomList);

      expect(redisService.setJson).toHaveBeenCalledWith(
        'cache:room:list',
        roomList,
        30, // 기본 TTL
      );
    });

    it('cacheRoomList - 커스텀 TTL', async () => {
      const roomList = [roomData];

      await service.cacheRoomList(roomList, 60);

      expect(redisService.setJson).toHaveBeenCalledWith(
        'cache:room:list',
        roomList,
        60,
      );
    });

    it('getCachedRoomList - Room 목록 조회', async () => {
      const roomList = [roomData];
      redisService.getJson.mockResolvedValue(roomList);

      const result = await service.getCachedRoomList();

      expect(result).toEqual(roomList);
      expect(redisService.getJson).toHaveBeenCalledWith('cache:room:list');
    });

    it('invalidateRoomList - Room 목록 캐시 무효화', async () => {
      await service.invalidateRoomList();

      expect(redisService.del).toHaveBeenCalledWith('cache:room:list');
    });
  });

  describe('Rate Limiting', () => {
    const identifier = 'user:123:api';
    const limit = 10;
    const windowSeconds = 60;

    it('checkRateLimit - 첫 요청 (허용)', async () => {
      redisService.incr.mockResolvedValue(1);
      redisService.ttl.mockResolvedValue(60);

      const result = await service.checkRateLimit(
        identifier,
        limit,
        windowSeconds,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(redisService.incr).toHaveBeenCalledWith(`ratelimit:${identifier}`);
      expect(redisService.expire).toHaveBeenCalledWith(
        `ratelimit:${identifier}`,
        windowSeconds,
      );
    });

    it('checkRateLimit - 제한 내 요청', async () => {
      redisService.incr.mockResolvedValue(5);
      redisService.ttl.mockResolvedValue(30);

      const result = await service.checkRateLimit(
        identifier,
        limit,
        windowSeconds,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(redisService.expire).not.toHaveBeenCalled(); // 첫 요청 아님
    });

    it('checkRateLimit - 제한 초과', async () => {
      redisService.incr.mockResolvedValue(11);
      redisService.ttl.mockResolvedValue(30);

      const result = await service.checkRateLimit(
        identifier,
        limit,
        windowSeconds,
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('checkRateLimit - 정확히 제한에 도달', async () => {
      redisService.incr.mockResolvedValue(10);
      redisService.ttl.mockResolvedValue(30);

      const result = await service.checkRateLimit(
        identifier,
        limit,
        windowSeconds,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  describe('invalidateByPattern', () => {
    it('패턴으로 캐시 일괄 삭제', async () => {
      redisService.keys.mockResolvedValue([
        'cache:user:1',
        'cache:user:2',
        'cache:user:3',
      ]);

      const result = await service.invalidateByPattern('user:*');

      expect(redisService.keys).toHaveBeenCalledWith('cache:user:*');
      expect(redisService.del).toHaveBeenCalledTimes(3);
      expect(result).toBe(3);
    });

    it('삭제할 키가 없는 경우', async () => {
      redisService.keys.mockResolvedValue([]);

      const result = await service.invalidateByPattern('nonexistent:*');

      expect(result).toBe(0);
      expect(redisService.del).not.toHaveBeenCalled();
    });
  });
});
