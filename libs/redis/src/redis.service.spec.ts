import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './constants';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      keys: jest.fn(),
      publish: jest.fn(),
      incr: jest.fn(),
      incrby: jest.fn(),
      decr: jest.fn(),
      quit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 조작', () => {
    it('get - 키 값 조회', async () => {
      mockRedis.get.mockResolvedValue('value');
      const result = await service.get('key');
      expect(result).toBe('value');
      expect(mockRedis.get).toHaveBeenCalledWith('key');
    });

    it('set - TTL 없이 값 저장', async () => {
      await service.set('key', 'value');
      expect(mockRedis.set).toHaveBeenCalledWith('key', 'value');
    });

    it('set - TTL과 함께 값 저장', async () => {
      await service.set('key', 'value', 60);
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, 'value');
    });

    it('del - 키 삭제', async () => {
      mockRedis.del.mockResolvedValue(1);
      const result = await service.del('key');
      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('key');
    });

    it('exists - 키 존재 여부 확인', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const result = await service.exists('key');
      expect(result).toBe(true);
    });

    it('exists - 키가 없는 경우', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const result = await service.exists('key');
      expect(result).toBe(false);
    });

    it('expire - TTL 설정', async () => {
      mockRedis.expire.mockResolvedValue(1);
      const result = await service.expire('key', 60);
      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('key', 60);
    });

    it('ttl - 남은 TTL 조회', async () => {
      mockRedis.ttl.mockResolvedValue(30);
      const result = await service.ttl('key');
      expect(result).toBe(30);
    });
  });

  describe('JSON 조작', () => {
    it('getJson - JSON 파싱', async () => {
      const data = { name: 'test', value: 123 };
      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      const result = await service.getJson<typeof data>('key');
      expect(result).toEqual(data);
    });

    it('getJson - 값이 없는 경우', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.getJson('key');
      expect(result).toBeNull();
    });

    it('getJson - 잘못된 JSON', async () => {
      mockRedis.get.mockResolvedValue('invalid json');
      const result = await service.getJson('key');
      expect(result).toBeNull();
    });

    it('setJson - JSON 저장', async () => {
      const data = { name: 'test', value: 123 };
      await service.setJson('key', data, 60);
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, JSON.stringify(data));
    });
  });

  describe('Hash 조작', () => {
    it('hget - 해시 필드 조회', async () => {
      mockRedis.hget.mockResolvedValue('value');
      const result = await service.hget('hash', 'field');
      expect(result).toBe('value');
      expect(mockRedis.hget).toHaveBeenCalledWith('hash', 'field');
    });

    it('hset - 해시 필드 설정', async () => {
      mockRedis.hset.mockResolvedValue(1);
      const result = await service.hset('hash', 'field', 'value');
      expect(result).toBe(1);
      expect(mockRedis.hset).toHaveBeenCalledWith('hash', 'field', 'value');
    });

    it('hgetall - 해시 전체 조회', async () => {
      const data = { field1: 'value1', field2: 'value2' };
      mockRedis.hgetall.mockResolvedValue(data);
      const result = await service.hgetall('hash');
      expect(result).toEqual(data);
    });

    it('hdel - 해시 필드 삭제', async () => {
      mockRedis.hdel.mockResolvedValue(2);
      const result = await service.hdel('hash', 'field1', 'field2');
      expect(result).toBe(2);
      expect(mockRedis.hdel).toHaveBeenCalledWith('hash', 'field1', 'field2');
    });
  });

  describe('Set 조작', () => {
    it('sadd - Set에 멤버 추가', async () => {
      mockRedis.sadd.mockResolvedValue(2);
      const result = await service.sadd('set', 'member1', 'member2');
      expect(result).toBe(2);
    });

    it('srem - Set에서 멤버 제거', async () => {
      mockRedis.srem.mockResolvedValue(1);
      const result = await service.srem('set', 'member1');
      expect(result).toBe(1);
    });

    it('smembers - Set 멤버 조회', async () => {
      mockRedis.smembers.mockResolvedValue(['member1', 'member2']);
      const result = await service.smembers('set');
      expect(result).toEqual(['member1', 'member2']);
    });

    it('sismember - Set 멤버 존재 확인', async () => {
      mockRedis.sismember.mockResolvedValue(1);
      const result = await service.sismember('set', 'member1');
      expect(result).toBe(true);
    });
  });

  describe('기타 조작', () => {
    it('keys - 패턴으로 키 검색', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);
      const result = await service.keys('key*');
      expect(result).toEqual(['key1', 'key2']);
    });

    it('publish - 채널에 메시지 발행', async () => {
      mockRedis.publish.mockResolvedValue(1);
      const result = await service.publish('channel', 'message');
      expect(result).toBe(1);
    });

    it('incr - 증가', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const result = await service.incr('counter');
      expect(result).toBe(1);
    });

    it('incrby - 지정 값만큼 증가', async () => {
      mockRedis.incrby.mockResolvedValue(5);
      const result = await service.incrby('counter', 5);
      expect(result).toBe(5);
    });

    it('decr - 감소', async () => {
      mockRedis.decr.mockResolvedValue(0);
      const result = await service.decr('counter');
      expect(result).toBe(0);
    });
  });

  describe('라이프사이클', () => {
    it('onModuleDestroy - Redis 연결 종료', async () => {
      await service.onModuleDestroy();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('getClient - Redis 클라이언트 반환', () => {
      const client = service.getClient();
      expect(client).toBe(mockRedis);
    });
  });
});
