import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RpcResponse } from '@app/shared';

describe('RoomsController', () => {
  let controller: RoomsController;
  let roomsService: jest.Mocked<RoomsService>;

  const mockRoomsService = {
    createRoom: jest.fn(),
    listRooms: jest.fn(),
    getRoom: jest.fn(),
    deleteRoom: jest.fn(),
    joinRoom: jest.fn(),
    listParticipants: jest.fn(),
    removeParticipant: jest.fn(),
    muteParticipant: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        {
          provide: RoomsService,
          useValue: mockRoomsService,
        },
      ],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
    roomsService = module.get(RoomsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRoom', () => {
    const createRoomDto = {
      name: 'test-room',
      emptyTimeout: 300,
      maxParticipants: 10,
    };

    it('should create a room successfully', async () => {
      const mockRoom = { sid: 'RM_123', name: 'test-room' };
      const mockResponse: RpcResponse = { success: true, data: mockRoom };
      mockRoomsService.createRoom.mockResolvedValue(mockResponse);

      const result = await controller.createRoom(createRoomDto);

      expect(roomsService.createRoom).toHaveBeenCalledWith(createRoomDto);
      expect(result).toEqual(mockRoom);
    });

    it('should throw HttpException on failure', async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: 'Room already exists',
      };
      mockRoomsService.createRoom.mockResolvedValue(mockResponse);

      await expect(controller.createRoom(createRoomDto)).rejects.toThrow(
        new HttpException('Room already exists', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('listRooms', () => {
    it('should list all rooms', async () => {
      const mockRooms = [
        { sid: 'RM_1', name: 'room1' },
        { sid: 'RM_2', name: 'room2' },
      ];
      const mockResponse: RpcResponse = { success: true, data: mockRooms };
      mockRoomsService.listRooms.mockResolvedValue(mockResponse);

      const result = await controller.listRooms();

      expect(roomsService.listRooms).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockRooms);
    });

    it('should list rooms by names (string)', async () => {
      const mockRooms = [{ sid: 'RM_1', name: 'room1' }];
      const mockResponse: RpcResponse = { success: true, data: mockRooms };
      mockRoomsService.listRooms.mockResolvedValue(mockResponse);

      const result = await controller.listRooms('room1');

      expect(roomsService.listRooms).toHaveBeenCalledWith(['room1']);
      expect(result).toEqual(mockRooms);
    });

    it('should list rooms by names (array)', async () => {
      const mockRooms = [
        { sid: 'RM_1', name: 'room1' },
        { sid: 'RM_2', name: 'room2' },
      ];
      const mockResponse: RpcResponse = { success: true, data: mockRooms };
      mockRoomsService.listRooms.mockResolvedValue(mockResponse);

      const result = await controller.listRooms(['room1', 'room2']);

      expect(roomsService.listRooms).toHaveBeenCalledWith(['room1', 'room2']);
      expect(result).toEqual(mockRooms);
    });
  });

  describe('getRoom', () => {
    it('should get a specific room', async () => {
      const mockRoom = { sid: 'RM_123', name: 'test-room' };
      const mockResponse: RpcResponse = { success: true, data: mockRoom };
      mockRoomsService.getRoom.mockResolvedValue(mockResponse);

      const result = await controller.getRoom('test-room');

      expect(roomsService.getRoom).toHaveBeenCalledWith('test-room');
      expect(result).toEqual(mockRoom);
    });

    it('should throw HttpException when room not found', async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: 'Room not found',
      };
      mockRoomsService.getRoom.mockResolvedValue(mockResponse);

      await expect(controller.getRoom('nonexistent')).rejects.toThrow(
        new HttpException('Room not found', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('deleteRoom', () => {
    it('should delete a room successfully', async () => {
      const mockResponse: RpcResponse = { success: true, data: null };
      mockRoomsService.deleteRoom.mockResolvedValue(mockResponse);

      const result = await controller.deleteRoom('test-room');

      expect(roomsService.deleteRoom).toHaveBeenCalledWith('test-room');
      expect(result).toBeNull();
    });
  });

  describe('joinRoom', () => {
    const joinDto = {
      identity: 'user1',
      name: 'Test User',
      roomName: 'test-room',
    };

    it('should join a room and return token', async () => {
      const mockTokenData = {
        token: 'jwt-token',
        wsUrl: 'ws://localhost:7880',
        roomName: 'test-room',
        identity: 'user1',
      };
      const mockResponse: RpcResponse = { success: true, data: mockTokenData };
      mockRoomsService.joinRoom.mockResolvedValue(mockResponse);

      const result = await controller.joinRoom('test-room', joinDto);

      expect(roomsService.joinRoom).toHaveBeenCalledWith({
        ...joinDto,
        roomName: 'test-room',
      });
      expect(result).toEqual(mockTokenData);
    });
  });

  describe('listParticipants', () => {
    it('should list participants in a room', async () => {
      const mockParticipants = [
        { sid: 'PA_1', identity: 'user1' },
        { sid: 'PA_2', identity: 'user2' },
      ];
      const mockResponse: RpcResponse = {
        success: true,
        data: mockParticipants,
      };
      mockRoomsService.listParticipants.mockResolvedValue(mockResponse);

      const result = await controller.listParticipants('test-room');

      expect(roomsService.listParticipants).toHaveBeenCalledWith('test-room');
      expect(result).toEqual(mockParticipants);
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant from a room', async () => {
      const mockResponse: RpcResponse = { success: true, data: null };
      mockRoomsService.removeParticipant.mockResolvedValue(mockResponse);

      const result = await controller.removeParticipant('test-room', 'user1');

      expect(roomsService.removeParticipant).toHaveBeenCalledWith(
        'test-room',
        'user1',
      );
      expect(result).toBeNull();
    });
  });

  describe('muteParticipant', () => {
    it('should mute a participant', async () => {
      const mockResponse: RpcResponse = { success: true, data: null };
      mockRoomsService.muteParticipant.mockResolvedValue(mockResponse);

      const result = await controller.muteParticipant('test-room', 'user1', {
        trackSource: 'microphone',
        muted: true,
      });

      expect(roomsService.muteParticipant).toHaveBeenCalledWith(
        'test-room',
        'user1',
        'microphone',
        true,
      );
      expect(result).toBeNull();
    });

    it('should unmute a participant', async () => {
      const mockResponse: RpcResponse = { success: true, data: null };
      mockRoomsService.muteParticipant.mockResolvedValue(mockResponse);

      const result = await controller.muteParticipant('test-room', 'user1', {
        trackSource: 'camera',
        muted: false,
      });

      expect(roomsService.muteParticipant).toHaveBeenCalledWith(
        'test-room',
        'user1',
        'camera',
        false,
      );
      expect(result).toBeNull();
    });
  });
});
