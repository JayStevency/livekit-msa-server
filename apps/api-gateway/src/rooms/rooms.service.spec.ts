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
import { of } from 'rxjs';

describe('RoomsService', () => {
  let service: RoomsService;
  let clientProxy: jest.Mocked<ClientProxy>;

  const mockClientProxy = {
    send: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: LIVEKIT_SERVICE,
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    clientProxy = module.get(LIVEKIT_SERVICE);

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
  });

  describe('listRooms', () => {
    it('should send list rooms message without names', async () => {
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

    it('should send list rooms message with names', async () => {
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

      expect(clientProxy.send).toHaveBeenCalledWith(LIVEKIT_LIST_ROOMS, {
        names,
      });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getRoom', () => {
    it('should send get room message', async () => {
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
