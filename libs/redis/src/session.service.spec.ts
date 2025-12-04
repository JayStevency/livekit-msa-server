import { Test, TestingModule } from '@nestjs/testing';
import { SessionService, UserSession, RoomSession } from './session.service';
import { RedisService } from './redis.service';

describe('SessionService', () => {
  let service: SessionService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('사용자 세션', () => {
    const userId = 'user-123';
    const sessionKey = `session:user:${userId}`;

    it('createUserSession - 사용자 세션 생성', async () => {
      const sessionData = {
        identity: 'test-user',
        roomName: 'test-room',
      };

      const result = await service.createUserSession(userId, sessionData);

      expect(result.userId).toBe(userId);
      expect(result.identity).toBe(sessionData.identity);
      expect(result.roomName).toBe(sessionData.roomName);
      expect(result.connectedAt).toBeDefined();
      expect(result.lastActiveAt).toBeDefined();
      expect(redisService.setJson).toHaveBeenCalledWith(
        sessionKey,
        expect.objectContaining({
          userId,
          identity: sessionData.identity,
          roomName: sessionData.roomName,
        }),
        3600,
      );
    });

    it('createUserSession - identity 기본값', async () => {
      const result = await service.createUserSession(userId, {});

      expect(result.identity).toBe(userId);
    });

    it('getUserSession - 세션 조회', async () => {
      const mockSession: UserSession = {
        userId,
        identity: 'test-user',
        roomName: 'test-room',
        connectedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      redisService.getJson.mockResolvedValue(mockSession);

      const result = await service.getUserSession(userId);

      expect(result).toEqual(mockSession);
      expect(redisService.getJson).toHaveBeenCalledWith(sessionKey);
    });

    it('getUserSession - 세션이 없는 경우', async () => {
      redisService.getJson.mockResolvedValue(null);

      const result = await service.getUserSession(userId);

      expect(result).toBeNull();
    });

    it('refreshUserSession - 세션 갱신', async () => {
      const mockSession: UserSession = {
        userId,
        identity: 'test-user',
        connectedAt: Date.now() - 10000,
        lastActiveAt: Date.now() - 10000,
      };
      redisService.getJson.mockResolvedValue(mockSession);

      const result = await service.refreshUserSession(userId);

      expect(result).toBe(true);
      expect(redisService.setJson).toHaveBeenCalledWith(
        sessionKey,
        expect.objectContaining({
          userId,
          lastActiveAt: expect.any(Number),
        }),
        3600,
      );
    });

    it('refreshUserSession - 세션이 없는 경우', async () => {
      redisService.getJson.mockResolvedValue(null);

      const result = await service.refreshUserSession(userId);

      expect(result).toBe(false);
      expect(redisService.setJson).not.toHaveBeenCalled();
    });

    it('deleteUserSession - 세션 삭제', async () => {
      redisService.del.mockResolvedValue(1);

      const result = await service.deleteUserSession(userId);

      expect(result).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith(sessionKey);
    });

    it('deleteUserSession - 삭제할 세션이 없는 경우', async () => {
      redisService.del.mockResolvedValue(0);

      const result = await service.deleteUserSession(userId);

      expect(result).toBe(false);
    });
  });

  describe('방 참가/퇴장', () => {
    const userId = 'user-123';
    const roomName = 'test-room';

    it('joinRoom - 방 참가', async () => {
      const mockSession: UserSession = {
        userId,
        identity: 'test-user',
        connectedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      redisService.getJson
        .mockResolvedValueOnce(mockSession) // getUserSession
        .mockResolvedValueOnce(null); // getRoomSession (새 방)

      await service.joinRoom(userId, roomName);

      // 사용자 세션 업데이트
      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:user:${userId}`,
        expect.objectContaining({
          roomName,
        }),
        expect.any(Number),
      );

      // 방 세션에 참가자 추가
      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:room:${roomName}`,
        expect.objectContaining({
          roomName,
          participants: [userId],
        }),
        expect.any(Number),
      );
    });

    it('leaveRoom - 방 퇴장', async () => {
      const mockUserSession: UserSession = {
        userId,
        identity: 'test-user',
        roomName,
        connectedAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      const mockRoomSession: RoomSession = {
        roomName,
        createdAt: Date.now(),
        participants: [userId, 'other-user'],
      };
      redisService.getJson
        .mockResolvedValueOnce(mockUserSession) // getUserSession
        .mockResolvedValueOnce(mockRoomSession); // getRoomSession

      await service.leaveRoom(userId, roomName);

      // 사용자 세션에서 roomName 제거
      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:user:${userId}`,
        expect.objectContaining({
          roomName: undefined,
        }),
        expect.any(Number),
      );

      // 방 세션에서 참가자 제거
      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:room:${roomName}`,
        expect.objectContaining({
          participants: ['other-user'],
        }),
        expect.any(Number),
      );
    });
  });

  describe('방 세션', () => {
    const roomName = 'test-room';
    const roomKey = `session:room:${roomName}`;

    it('createRoomSession - 방 세션 생성', async () => {
      const metadata = { type: 'voice-chat' };

      const result = await service.createRoomSession(roomName, metadata);

      expect(result.roomName).toBe(roomName);
      expect(result.participants).toEqual([]);
      expect(result.metadata).toEqual(metadata);
      expect(result.createdAt).toBeDefined();
      expect(redisService.setJson).toHaveBeenCalledWith(
        roomKey,
        expect.objectContaining({
          roomName,
          participants: [],
          metadata,
        }),
        86400, // 24시간
      );
    });

    it('getRoomSession - 방 세션 조회', async () => {
      const mockSession: RoomSession = {
        roomName,
        createdAt: Date.now(),
        participants: ['user-1', 'user-2'],
      };
      redisService.getJson.mockResolvedValue(mockSession);

      const result = await service.getRoomSession(roomName);

      expect(result).toEqual(mockSession);
    });

    it('deleteRoomSession - 방 세션 삭제', async () => {
      redisService.del.mockResolvedValue(1);

      const result = await service.deleteRoomSession(roomName);

      expect(result).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith(roomKey);
    });

    it('getRoomParticipants - 참가자 목록 조회', async () => {
      const mockSession: RoomSession = {
        roomName,
        createdAt: Date.now(),
        participants: ['user-1', 'user-2'],
      };
      redisService.getJson.mockResolvedValue(mockSession);

      const result = await service.getRoomParticipants(roomName);

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('getRoomParticipants - 세션이 없는 경우', async () => {
      redisService.getJson.mockResolvedValue(null);

      const result = await service.getRoomParticipants(roomName);

      expect(result).toEqual([]);
    });

    it('getActiveRooms - 활성 방 목록', async () => {
      redisService.keys.mockResolvedValue([
        'session:room:room-1',
        'session:room:room-2',
      ]);

      const result = await service.getActiveRooms();

      expect(result).toEqual(['room-1', 'room-2']);
    });
  });

  describe('참가자 관리', () => {
    const roomName = 'test-room';
    const userId = 'user-123';

    it('addParticipantToRoom - 새 방에 참가자 추가', async () => {
      redisService.getJson.mockResolvedValue(null);

      await service.addParticipantToRoom(roomName, userId);

      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:room:${roomName}`,
        expect.objectContaining({
          participants: [userId],
        }),
        expect.any(Number),
      );
    });

    it('addParticipantToRoom - 기존 방에 참가자 추가', async () => {
      const mockSession: RoomSession = {
        roomName,
        createdAt: Date.now(),
        participants: ['other-user'],
      };
      redisService.getJson.mockResolvedValue(mockSession);

      await service.addParticipantToRoom(roomName, userId);

      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:room:${roomName}`,
        expect.objectContaining({
          participants: ['other-user', userId],
        }),
        expect.any(Number),
      );
    });

    it('addParticipantToRoom - 이미 참가한 경우 중복 추가 안함', async () => {
      const mockSession: RoomSession = {
        roomName,
        createdAt: Date.now(),
        participants: [userId],
      };
      redisService.getJson.mockResolvedValue(mockSession);

      await service.addParticipantToRoom(roomName, userId);

      // setJson이 호출되지 않아야 함
      expect(redisService.setJson).not.toHaveBeenCalled();
    });

    it('removeParticipantFromRoom - 참가자 제거', async () => {
      const mockSession: RoomSession = {
        roomName,
        createdAt: Date.now(),
        participants: [userId, 'other-user'],
      };
      redisService.getJson.mockResolvedValue(mockSession);

      await service.removeParticipantFromRoom(roomName, userId);

      expect(redisService.setJson).toHaveBeenCalledWith(
        `session:room:${roomName}`,
        expect.objectContaining({
          participants: ['other-user'],
        }),
        expect.any(Number),
      );
    });

    it('removeParticipantFromRoom - 세션이 없는 경우', async () => {
      redisService.getJson.mockResolvedValue(null);

      await service.removeParticipantFromRoom(roomName, userId);

      expect(redisService.setJson).not.toHaveBeenCalled();
    });
  });
});
