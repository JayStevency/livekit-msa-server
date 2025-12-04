import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { ClientProxy } from '@nestjs/microservices';
import {
  LIVEKIT_SERVICE,
  LIVEKIT_CREATE_TOKEN,
  LIVEKIT_CREATE_ROOM,
  LIVEKIT_DELETE_ROOM,
  LIVEKIT_LIST_ROOMS,
  LIVEKIT_GET_ROOM,
  LIVEKIT_LIST_PARTICIPANTS,
  LIVEKIT_REMOVE_PARTICIPANT,
  LIVEKIT_MUTE_PARTICIPANT,
} from '@app/shared';
import { CacheService, SessionService } from '@app/redis';
import { of } from 'rxjs';

describe('RoomsService', () => {
  let service: RoomsService;
  let clientProxy: jest.Mocked<ClientProxy>;
  let cacheService: jest.Mocked<CacheService>;
  let sessionService: jest.Mocked<SessionService>;

  const mockClientProxy = {
    send: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  };

  const mockCacheService = {
    getCachedRoomList: jest.fn(),
    cacheRoomList: jest.fn(),
    getCachedRoom: jest.fn(),
    cacheRoom: jest.fn(),
    invalidateRoom: jest.fn(),
    invalidateRoomList: jest.fn(),
    invalidateRoomTokens: jest.fn(),
  };

  const mockSessionService = {
    createRoomSession: jest.fn(),
    deleteRoomSession: jest.fn(),
    createUserSession: jest.fn(),
    joinRoom: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: LIVEKIT_SERVICE,
          useValue: mockClientProxy,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    clientProxy = module.get(LIVEKIT_SERVICE);
    cacheService = module.get(CacheService);
    sessionService = module.get(SessionService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should send create room message to livekit service', async () => {
      const dto = {
        name: 'test-room',
        emptyTimeout: 300,
        maxParticipants: 10,
        metadata: 'test metadata',
      };
      const expectedResponse = {
        success: true,
        data: { sid: 'RM_123', name: 'test-room' },
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.createRoom(dto);

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_CREATE_ROOM, {
        name: dto.name,
        emptyTimeout: dto.emptyTimeout,
        maxParticipants: dto.maxParticipants,
        metadata: dto.metadata,
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should invalidate room list cache on success', async () => {
      const dto = { name: 'test-room' };
      const expectedResponse = { success: true, data: { name: 'test-room' } };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      await service.createRoom(dto);

      expect(cacheService.invalidateRoomList).toHaveBeenCalled();
    });

    it('should create room session on success', async () => {
      const dto = { name: 'test-room', metadata: 'test-meta' };
      const expectedResponse = { success: true, data: { name: 'test-room' } };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      await service.createRoom(dto);

      expect(sessionService.createRoomSession).toHaveBeenCalledWith(
        dto.name,
        { metadata: dto.metadata },
      );
    });

    it('should not invalidate cache on failure', async () => {
      const dto = { name: 'test-room' };
      const expectedResponse = { success: false, error: 'Failed to create' };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      await service.createRoom(dto);

      expect(cacheService.invalidateRoomList).not.toHaveBeenCalled();
      expect(sessionService.createRoomSession).not.toHaveBeenCalled();
    });
  });

  describe('listRooms', () => {
    it('should return cached room list if available', async () => {
      const cachedRooms = [{ sid: 'RM_1', name: 'room1' }];
      mockCacheService.getCachedRoomList.mockResolvedValue(cachedRooms);

      const result = await service.listRooms();

      expect(result).toEqual({ success: true, data: cachedRooms });
      expect(clientProxy.send).not.toHaveBeenCalled();
    });

    it('should fetch from livekit if cache miss', async () => {
      mockCacheService.getCachedRoomList.mockResolvedValue(null);
      const expectedResponse = {
        success: true,
        data: [{ sid: 'RM_1', name: 'room1' }],
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.listRooms();

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_LIST_ROOMS, {
        names: undefined,
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should cache room list after fetch', async () => {
      mockCacheService.getCachedRoomList.mockResolvedValue(null);
      const rooms = [{ sid: 'RM_1', name: 'room1' }];
      mockClientProxy.send.mockReturnValue(of({ success: true, data: rooms }));

      await service.listRooms();

      expect(cacheService.cacheRoomList).toHaveBeenCalledWith(rooms, 30);
    });

    it('should skip cache for filtered room list', async () => {
      const names = ['room1', 'room2'];
      const expectedResponse = {
        success: true,
        data: [
          { sid: 'RM_1', name: 'room1' },
          { sid: 'RM_2', name: 'room2' },
        ],
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.listRooms(names);

      expect(cacheService.getCachedRoomList).not.toHaveBeenCalled();
      expect(cacheService.cacheRoomList).not.toHaveBeenCalled();
      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_LIST_ROOMS, {
        names,
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getRoom', () => {
    it('should return cached room if available', async () => {
      const cachedRoom = { sid: 'RM_123', name: 'test-room' };
      mockCacheService.getCachedRoom.mockResolvedValue(cachedRoom);

      const result = await service.getRoom('test-room');

      expect(result).toEqual({ success: true, data: cachedRoom });
      expect(clientProxy.send).not.toHaveBeenCalled();
    });

    it('should fetch from livekit if cache miss', async () => {
      mockCacheService.getCachedRoom.mockResolvedValue(null);
      const expectedResponse = {
        success: true,
        data: { sid: 'RM_123', name: 'test-room' },
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.getRoom('test-room');

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_GET_ROOM, {
        name: 'test-room',
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should cache room after fetch', async () => {
      mockCacheService.getCachedRoom.mockResolvedValue(null);
      const roomData = { sid: 'RM_123', name: 'test-room' };
      mockClientProxy.send.mockReturnValue(of({ success: true, data: roomData }));

      await service.getRoom('test-room');

      expect(cacheService.cacheRoom).toHaveBeenCalledWith('test-room', roomData, 60);
    });

    it('should not cache on failure', async () => {
      mockCacheService.getCachedRoom.mockResolvedValue(null);
      mockClientProxy.send.mockReturnValue(of({ success: false, error: 'Not found' }));

      await service.getRoom('test-room');

      expect(cacheService.cacheRoom).not.toHaveBeenCalled();
    });
  });

  describe('deleteRoom', () => {
    it('should send delete room message', async () => {
      const expectedResponse = { success: true, data: null };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.deleteRoom('test-room');

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_DELETE_ROOM, {
        name: 'test-room',
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should invalidate all related caches on success', async () => {
      mockClientProxy.send.mockReturnValue(of({ success: true, data: null }));

      await service.deleteRoom('test-room');

      expect(cacheService.invalidateRoom).toHaveBeenCalledWith('test-room');
      expect(cacheService.invalidateRoomList).toHaveBeenCalled();
      expect(cacheService.invalidateRoomTokens).toHaveBeenCalledWith('test-room');
    });

    it('should delete room session on success', async () => {
      mockClientProxy.send.mockReturnValue(of({ success: true, data: null }));

      await service.deleteRoom('test-room');

      expect(sessionService.deleteRoomSession).toHaveBeenCalledWith('test-room');
    });

    it('should not invalidate cache on failure', async () => {
      mockClientProxy.send.mockReturnValue(of({ success: false, error: 'Failed' }));

      await service.deleteRoom('test-room');

      expect(cacheService.invalidateRoom).not.toHaveBeenCalled();
      expect(cacheService.invalidateRoomList).not.toHaveBeenCalled();
      expect(sessionService.deleteRoomSession).not.toHaveBeenCalled();
    });
  });

  describe('joinRoom', () => {
    it('should send create token message with all options', async () => {
      const dto = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
        metadata: 'user metadata',
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
      };
      const expectedResponse = {
        success: true,
        data: {
          token: 'jwt-token',
          wsUrl: 'ws://localhost:7880',
          roomName: 'test-room',
          identity: 'user1',
        },
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.joinRoom(dto);

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_CREATE_TOKEN, {
        roomName: dto.roomName,
        identity: dto.identity,
        name: dto.name,
        metadata: dto.metadata,
        canPublish: dto.canPublish,
        canSubscribe: dto.canSubscribe,
        canPublishData: dto.canPublishData,
      });
      expect(result).toEqual(expectedResponse);
    });

    it('should use default values for optional permissions', async () => {
      const dto = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
      };
      const expectedResponse = {
        success: true,
        data: { token: 'jwt-token' },
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      await service.joinRoom(dto);

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_CREATE_TOKEN, {
        roomName: dto.roomName,
        identity: dto.identity,
        name: dto.name,
        metadata: undefined,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
    });

    it('should create user session on success', async () => {
      const dto = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
      };
      mockClientProxy.send.mockReturnValue(of({ success: true, data: { token: 'jwt' } }));

      await service.joinRoom(dto);

      expect(sessionService.createUserSession).toHaveBeenCalledWith(
        dto.identity,
        {
          identity: dto.identity,
          roomName: dto.roomName,
          metadata: { name: dto.name },
        },
      );
    });

    it('should join room session on success', async () => {
      const dto = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
      };
      mockClientProxy.send.mockReturnValue(of({ success: true, data: { token: 'jwt' } }));

      await service.joinRoom(dto);

      expect(sessionService.joinRoom).toHaveBeenCalledWith(dto.identity, dto.roomName);
    });

    it('should not create session on failure', async () => {
      const dto = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
      };
      mockClientProxy.send.mockReturnValue(of({ success: false, error: 'Failed' }));

      await service.joinRoom(dto);

      expect(sessionService.createUserSession).not.toHaveBeenCalled();
      expect(sessionService.joinRoom).not.toHaveBeenCalled();
    });
  });

  describe('listParticipants', () => {
    it('should send list participants message', async () => {
      const expectedResponse = {
        success: true,
        data: [
          { sid: 'PA_1', identity: 'user1' },
          { sid: 'PA_2', identity: 'user2' },
        ],
      };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.listParticipants('test-room');

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_LIST_PARTICIPANTS, {
        roomName: 'test-room',
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('removeParticipant', () => {
    it('should send remove participant message', async () => {
      const expectedResponse = { success: true, data: null };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.removeParticipant('test-room', 'user1');

      expect(clientProxy.send).toHaveBeenCalledWith(
        LIVEKIT_REMOVE_PARTICIPANT,
        {
          roomName: 'test-room',
          identity: 'user1',
        },
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('muteParticipant', () => {
    it('should send mute participant message', async () => {
      const expectedResponse = { success: true, data: null };
      mockClientProxy.send.mockReturnValue(of(expectedResponse));

      const result = await service.muteParticipant(
        'test-room',
        'user1',
        'microphone',
        true,
      );

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_MUTE_PARTICIPANT, {
        roomName: 'test-room',
        identity: 'user1',
        trackSource: 'microphone',
        muted: true,
      });
      expect(result).toEqual(expectedResponse);
    });
  });
});
