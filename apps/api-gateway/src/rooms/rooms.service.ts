import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { rpcSend } from '@app/rabbitmq';
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
  CreateRoomDto,
  JoinRoomDto,
  RpcResponse,
} from '@app/shared';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(LIVEKIT_SERVICE) private readonly livekitClient: ClientProxy,
  ) {}

  async createRoom(dto: CreateRoomDto): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_CREATE_ROOM, {
      name: dto.name,
      emptyTimeout: dto.emptyTimeout,
      maxParticipants: dto.maxParticipants,
      metadata: dto.metadata,
    });
  }

  async listRooms(names?: string[]): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_LIST_ROOMS, {
      names,
    });
  }

  async getRoom(name: string): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_GET_ROOM, { name });
  }

  async deleteRoom(name: string): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_DELETE_ROOM, {
      name,
    });
  }

  async joinRoom(dto: JoinRoomDto): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_CREATE_TOKEN, {
      roomName: dto.roomName,
      identity: dto.identity,
      name: dto.name,
      metadata: dto.metadata,
      canPublish: dto.canPublish ?? true,
      canSubscribe: dto.canSubscribe ?? true,
      canPublishData: dto.canPublishData ?? true,
    });
  }

  async listParticipants(roomName: string): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_LIST_PARTICIPANTS, {
      roomName,
    });
  }

  async removeParticipant(
    roomName: string,
    identity: string,
  ): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_REMOVE_PARTICIPANT, {
      roomName,
      identity,
    });
  }

  async muteParticipant(
    roomName: string,
    identity: string,
    trackSource: string,
    muted: boolean,
  ): Promise<RpcResponse> {
    return rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_MUTE_PARTICIPANT, {
      roomName,
      identity,
      trackSource,
      muted,
    });
  }
}
