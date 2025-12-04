import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { rpcSend } from '@app/rabbitmq';
import { CacheService, SessionService } from '@app/redis';
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
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(LIVEKIT_SERVICE) private readonly livekitClient: ClientProxy,
    private readonly cacheService: CacheService,
    private readonly sessionService: SessionService,
  ) {}

  async createRoom(dto: CreateRoomDto): Promise<RpcResponse> {
    const result = await rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_CREATE_ROOM, {
      name: dto.name,
      emptyTimeout: dto.emptyTimeout,
      maxParticipants: dto.maxParticipants,
      metadata: dto.metadata,
    });

    // 캐시 무효화 (새 방 생성 시 목록 캐시 무효화)
    if (result.success) {
      await this.cacheService.invalidateRoomList();
      // 방 세션 생성
      await this.sessionService.createRoomSession(dto.name, { metadata: dto.metadata });
      this.logger.debug(`Room created and cached: ${dto.name}`);
    }

    return result;
  }

  async listRooms(names?: string[]): Promise<RpcResponse> {
    // 캐시 체크 (특정 이름 필터 없을 때만)
    if (!names || names.length === 0) {
      const cached = await this.cacheService.getCachedRoomList<any>();
      if (cached) {
        this.logger.debug('Returning cached room list');
        return { success: true, data: cached };
      }
    }

    const result = await rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_LIST_ROOMS, {
      names,
    });

    // 결과 캐싱 (특정 이름 필터 없을 때만)
    if (result.success && (!names || names.length === 0) && Array.isArray(result.data)) {
      await this.cacheService.cacheRoomList(result.data as unknown[], 30); // 30초 캐시
      this.logger.debug('Room list cached');
    }

    return result;
  }

  async getRoom(name: string): Promise<RpcResponse> {
    // 캐시 체크
    const cached = await this.cacheService.getCachedRoom<any>(name);
    if (cached) {
      this.logger.debug(`Returning cached room: ${name}`);
      return { success: true, data: cached };
    }

    const result = await rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_GET_ROOM, { name });

    // 결과 캐싱
    if (result.success && result.data) {
      await this.cacheService.cacheRoom(name, result.data, 60); // 1분 캐시
      this.logger.debug(`Room cached: ${name}`);
    }

    return result;
  }

  async deleteRoom(name: string): Promise<RpcResponse> {
    const result = await rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_DELETE_ROOM, {
      name,
    });

    // 캐시 무효화
    if (result.success) {
      await this.cacheService.invalidateRoom(name);
      await this.cacheService.invalidateRoomList();
      await this.cacheService.invalidateRoomTokens(name);
      await this.sessionService.deleteRoomSession(name);
      this.logger.debug(`Room deleted and cache invalidated: ${name}`);
    }

    return result;
  }

  async joinRoom(dto: JoinRoomDto): Promise<RpcResponse> {
    const result = await rpcSend<RpcResponse>(this.livekitClient, LIVEKIT_CREATE_TOKEN, {
      roomName: dto.roomName,
      identity: dto.identity,
      name: dto.name,
      metadata: dto.metadata,
      canPublish: dto.canPublish ?? true,
      canSubscribe: dto.canSubscribe ?? true,
      canPublishData: dto.canPublishData ?? true,
    });

    // 세션 관리
    if (result.success) {
      // 사용자 세션 생성/업데이트
      await this.sessionService.createUserSession(dto.identity, {
        identity: dto.identity,
        roomName: dto.roomName,
        metadata: { name: dto.name },
      });
      // 방 참가 처리
      await this.sessionService.joinRoom(dto.identity, dto.roomName);
      this.logger.debug(`User session created: ${dto.identity} joined ${dto.roomName}`);
    }

    return result;
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
