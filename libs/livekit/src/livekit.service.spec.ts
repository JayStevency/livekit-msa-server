import { Test, TestingModule } from '@nestjs/testing';
import { LivekitService } from './livekit.service';
import { LIVEKIT_OPTIONS } from './livekit.constants';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';

jest.mock('livekit-server-sdk', () => {
  return {
    RoomServiceClient: jest.fn().mockImplementation(() => ({
      createRoom: jest.fn(),
      listRooms: jest.fn(),
      deleteRoom: jest.fn(),
      listParticipants: jest.fn(),
      getParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      mutePublishedTrack: jest.fn(),
      updateParticipant: jest.fn(),
      updateRoomMetadata: jest.fn(),
    })),
    AccessToken: jest.fn().mockImplementation(() => ({
      addGrant: jest.fn(),
      toJwt: jest.fn().mockResolvedValue('mock-jwt-token'),
    })),
    TrackSource: {
      MICROPHONE: 'MICROPHONE',
      CAMERA: 'CAMERA',
    },
  };
});

describe('LivekitService', () => {
  let service: LivekitService;
  let mockRoomServiceClient: jest.Mocked<RoomServiceClient>;

  const mockOptions = {
    wsUrl: 'ws://localhost:7880',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivekitService,
        {
          provide: LIVEKIT_OPTIONS,
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<LivekitService>(LivekitService);
    mockRoomServiceClient = (RoomServiceClient as jest.Mock).mock.results[0]
      ?.value;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with correct URL conversion', () => {
    expect(RoomServiceClient).toHaveBeenCalledWith(
      'http://localhost:7880',
      mockOptions.apiKey,
      mockOptions.apiSecret,
    );
  });

  describe('createToken', () => {
    it('should create a token with default options', async () => {
      const options = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
      };

      const token = await service.createToken(options);

      expect(AccessToken).toHaveBeenCalledWith(
        mockOptions.apiKey,
        mockOptions.apiSecret,
        expect.objectContaining({
          identity: options.identity,
          name: options.name,
          ttl: 3600,
        }),
      );
      expect(token).toBe('mock-jwt-token');
    });

    it('should create a token with custom options', async () => {
      const options = {
        roomName: 'test-room',
        identity: 'user1',
        name: 'Test User',
        metadata: 'custom metadata',
        canPublish: false,
        canSubscribe: true,
        canPublishData: false,
        ttl: 7200,
      };

      const token = await service.createToken(options);

      expect(AccessToken).toHaveBeenCalledWith(
        mockOptions.apiKey,
        mockOptions.apiSecret,
        expect.objectContaining({
          identity: options.identity,
          name: options.name,
          metadata: options.metadata,
          ttl: options.ttl,
        }),
      );
      expect(token).toBe('mock-jwt-token');
    });
  });

  describe('createRoom', () => {
    it('should create a room with default values', async () => {
      const mockRoom = { sid: 'RM_123', name: 'test-room' };
      mockRoomServiceClient.createRoom.mockResolvedValue(mockRoom as any);

      const result = await service.createRoom('test-room');

      expect(mockRoomServiceClient.createRoom).toHaveBeenCalledWith({
        name: 'test-room',
        emptyTimeout: 300,
        maxParticipants: 10,
        metadata: undefined,
      });
      expect(result).toEqual(mockRoom);
    });

    it('should create a room with custom values', async () => {
      const mockRoom = { sid: 'RM_123', name: 'test-room' };
      mockRoomServiceClient.createRoom.mockResolvedValue(mockRoom as any);

      const result = await service.createRoom('test-room', 600, 20, 'metadata');

      expect(mockRoomServiceClient.createRoom).toHaveBeenCalledWith({
        name: 'test-room',
        emptyTimeout: 600,
        maxParticipants: 20,
        metadata: 'metadata',
      });
      expect(result).toEqual(mockRoom);
    });
  });

  describe('listRooms', () => {
    it('should list all rooms', async () => {
      const mockRooms = [
        { sid: 'RM_1', name: 'room1' },
        { sid: 'RM_2', name: 'room2' },
      ];
      mockRoomServiceClient.listRooms.mockResolvedValue(mockRooms as any);

      const result = await service.listRooms();

      expect(mockRoomServiceClient.listRooms).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockRooms);
    });

    it('should list rooms by names', async () => {
      const mockRooms = [{ sid: 'RM_1', name: 'room1' }];
      mockRoomServiceClient.listRooms.mockResolvedValue(mockRooms as any);

      const result = await service.listRooms(['room1']);

      expect(mockRoomServiceClient.listRooms).toHaveBeenCalledWith(['room1']);
      expect(result).toEqual(mockRooms);
    });
  });

  describe('getRoom', () => {
    it('should get a room by name', async () => {
      const mockRoom = { sid: 'RM_123', name: 'test-room' };
      mockRoomServiceClient.listRooms.mockResolvedValue([mockRoom] as any);

      const result = await service.getRoom('test-room');

      expect(mockRoomServiceClient.listRooms).toHaveBeenCalledWith([
        'test-room',
      ]);
      expect(result).toEqual(mockRoom);
    });

    it('should return null when room not found', async () => {
      mockRoomServiceClient.listRooms.mockResolvedValue([]);

      const result = await service.getRoom('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteRoom', () => {
    it('should delete a room', async () => {
      mockRoomServiceClient.deleteRoom.mockResolvedValue(undefined);

      await service.deleteRoom('test-room');

      expect(mockRoomServiceClient.deleteRoom).toHaveBeenCalledWith(
        'test-room',
      );
    });
  });

  describe('listParticipants', () => {
    it('should list participants in a room', async () => {
      const mockParticipants = [
        { sid: 'PA_1', identity: 'user1' },
        { sid: 'PA_2', identity: 'user2' },
      ];
      mockRoomServiceClient.listParticipants.mockResolvedValue(
        mockParticipants as any,
      );

      const result = await service.listParticipants('test-room');

      expect(mockRoomServiceClient.listParticipants).toHaveBeenCalledWith(
        'test-room',
      );
      expect(result).toEqual(mockParticipants);
    });
  });

  describe('getParticipant', () => {
    it('should get a participant', async () => {
      const mockParticipant = { sid: 'PA_1', identity: 'user1' };
      mockRoomServiceClient.getParticipant.mockResolvedValue(
        mockParticipant as any,
      );

      const result = await service.getParticipant('test-room', 'user1');

      expect(mockRoomServiceClient.getParticipant).toHaveBeenCalledWith(
        'test-room',
        'user1',
      );
      expect(result).toEqual(mockParticipant);
    });

    it('should return null when participant not found', async () => {
      mockRoomServiceClient.getParticipant.mockRejectedValue(
        new Error('Not found'),
      );

      const result = await service.getParticipant('test-room', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant', async () => {
      mockRoomServiceClient.removeParticipant.mockResolvedValue(undefined);

      await service.removeParticipant('test-room', 'user1');

      expect(mockRoomServiceClient.removeParticipant).toHaveBeenCalledWith(
        'test-room',
        'user1',
      );
    });
  });

  describe('muteParticipant', () => {
    it('should mute a participant track', async () => {
      mockRoomServiceClient.mutePublishedTrack.mockResolvedValue(
        undefined as any,
      );

      await service.muteParticipant(
        'test-room',
        'user1',
        'MICROPHONE' as any,
        true,
      );

      expect(mockRoomServiceClient.mutePublishedTrack).toHaveBeenCalledWith(
        'test-room',
        'user1',
        'MICROPHONE',
        true,
      );
    });
  });

  describe('updateParticipant', () => {
    it('should update participant metadata', async () => {
      const mockParticipant = {
        sid: 'PA_1',
        identity: 'user1',
        metadata: 'new metadata',
      };
      mockRoomServiceClient.updateParticipant.mockResolvedValue(
        mockParticipant as any,
      );

      const result = await service.updateParticipant(
        'test-room',
        'user1',
        'new metadata',
        'New Name',
      );

      expect(mockRoomServiceClient.updateParticipant).toHaveBeenCalledWith(
        'test-room',
        'user1',
        'new metadata',
        undefined,
        'New Name',
      );
      expect(result).toEqual(mockParticipant);
    });
  });

  describe('updateRoomMetadata', () => {
    it('should update room metadata', async () => {
      const mockRoom = { sid: 'RM_123', name: 'test-room', metadata: 'updated' };
      mockRoomServiceClient.updateRoomMetadata.mockResolvedValue(
        mockRoom as any,
      );

      const result = await service.updateRoomMetadata('test-room', 'updated');

      expect(mockRoomServiceClient.updateRoomMetadata).toHaveBeenCalledWith(
        'test-room',
        'updated',
      );
      expect(result).toEqual(mockRoom);
    });
  });

  describe('getWsUrl', () => {
    it('should return the websocket URL', () => {
      const wsUrl = service.getWsUrl();
      expect(wsUrl).toBe(mockOptions.wsUrl);
    });
  });
});
