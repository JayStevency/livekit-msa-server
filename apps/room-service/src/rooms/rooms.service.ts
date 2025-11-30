import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { LivekitService } from '@app/livekit';
import {
  RpcResponse,
  createSuccessResponse,
  createErrorResponse,
  CreateRoomDto,
  JoinRoomDto,
} from '@app/shared';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekitService: LivekitService,
  ) {}

  async create(dto: CreateRoomDto): Promise<RpcResponse> {
    try {
      // Create room in LiveKit
      const livekitRoom = await this.livekitService.createRoom(
        dto.name,
        dto.emptyTimeout,
        dto.maxParticipants,
        dto.metadata,
      );

      // Store room in database
      const room = await this.prisma.room.create({
        data: {
          name: dto.name,
          livekitRoomName: livekitRoom.name,
          maxParticipants: dto.maxParticipants || 10,
          emptyTimeout: dto.emptyTimeout || 300,
          metadata: dto.metadata,
        },
      });

      return createSuccessResponse(room);
    } catch (error) {
      this.logger.error(`Failed to create room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async findAll(): Promise<RpcResponse> {
    try {
      const rooms = await this.prisma.room.findMany({
        where: { isActive: true },
        include: {
          participants: {
            where: { leftAt: null },
          },
        },
      });
      return createSuccessResponse(rooms);
    } catch (error) {
      this.logger.error(`Failed to find rooms: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async findOne(id: string): Promise<RpcResponse> {
    try {
      const room = await this.prisma.room.findUnique({
        where: { id },
        include: {
          participants: {
            where: { leftAt: null },
          },
        },
      });

      if (!room) {
        return createErrorResponse(`Room ${id} not found`);
      }

      return createSuccessResponse(room);
    } catch (error) {
      this.logger.error(`Failed to find room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async update(
    id: string,
    updates: Partial<CreateRoomDto>,
  ): Promise<RpcResponse> {
    try {
      const room = await this.prisma.room.update({
        where: { id },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.maxParticipants && {
            maxParticipants: updates.maxParticipants,
          }),
          ...(updates.emptyTimeout && { emptyTimeout: updates.emptyTimeout }),
          ...(updates.metadata && { metadata: updates.metadata }),
        },
      });

      return createSuccessResponse(room);
    } catch (error) {
      this.logger.error(`Failed to update room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async delete(id: string): Promise<RpcResponse> {
    try {
      const room = await this.prisma.room.findUnique({ where: { id } });

      if (!room) {
        return createErrorResponse(`Room ${id} not found`);
      }

      // Delete from LiveKit
      try {
        await this.livekitService.deleteRoom(room.livekitRoomName);
      } catch {
        // Room might not exist in LiveKit, continue
      }

      // Soft delete in database
      await this.prisma.room.update({
        where: { id },
        data: { isActive: false },
      });

      return createSuccessResponse({ deleted: true });
    } catch (error) {
      this.logger.error(`Failed to delete room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async join(dto: JoinRoomDto): Promise<RpcResponse> {
    try {
      const room = await this.prisma.room.findFirst({
        where: {
          OR: [{ id: dto.roomName }, { name: dto.roomName }],
          isActive: true,
        },
      });

      if (!room) {
        return createErrorResponse(`Room ${dto.roomName} not found`);
      }

      // Create participant record
      await this.prisma.roomParticipant.upsert({
        where: {
          roomId_identity: {
            roomId: room.id,
            identity: dto.identity,
          },
        },
        update: {
          name: dto.name,
          metadata: dto.metadata,
          joinedAt: new Date(),
          leftAt: null,
        },
        create: {
          roomId: room.id,
          identity: dto.identity,
          name: dto.name,
          metadata: dto.metadata,
        },
      });

      // Generate LiveKit token
      const token = await this.livekitService.createToken({
        roomName: room.livekitRoomName,
        identity: dto.identity,
        name: dto.name,
        metadata: dto.metadata,
        canPublish: dto.canPublish ?? true,
        canSubscribe: dto.canSubscribe ?? true,
        canPublishData: dto.canPublishData ?? true,
      });

      return createSuccessResponse({
        token,
        wsUrl: this.livekitService.getWsUrl(),
        room: {
          id: room.id,
          name: room.name,
          livekitRoomName: room.livekitRoomName,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to join room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async leave(roomId: string, identity: string): Promise<RpcResponse> {
    try {
      await this.prisma.roomParticipant.updateMany({
        where: {
          roomId,
          identity,
          leftAt: null,
        },
        data: {
          leftAt: new Date(),
        },
      });

      return createSuccessResponse({ left: true });
    } catch (error) {
      this.logger.error(`Failed to leave room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }
}
