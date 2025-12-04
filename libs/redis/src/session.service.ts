import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface UserSession {
  userId: string;
  identity: string;
  roomName?: string;
  connectedAt: number;
  lastActiveAt: number;
  metadata?: Record<string, any>;
}

export interface RoomSession {
  roomName: string;
  createdAt: number;
  participants: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSION_PREFIX = 'session:user:';
  private readonly ROOM_SESSION_PREFIX = 'session:room:';
  private readonly DEFAULT_TTL = 3600; // 1시간

  constructor(private readonly redis: RedisService) {}

  // ==================== 사용자 세션 ====================

  /**
   * 사용자 세션 생성/업데이트
   */
  async createUserSession(
    userId: string,
    data: Partial<UserSession>,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<UserSession> {
    const session: UserSession = {
      userId,
      identity: data.identity || userId,
      roomName: data.roomName,
      connectedAt: data.connectedAt || Date.now(),
      lastActiveAt: Date.now(),
      metadata: data.metadata,
    };

    await this.redis.setJson(
      this.getUserSessionKey(userId),
      session,
      ttlSeconds,
    );

    return session;
  }

  /**
   * 사용자 세션 조회
   */
  async getUserSession(userId: string): Promise<UserSession | null> {
    return this.redis.getJson<UserSession>(this.getUserSessionKey(userId));
  }

  /**
   * 사용자 세션 갱신 (활동 시간 업데이트)
   */
  async refreshUserSession(
    userId: string,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<boolean> {
    const session = await this.getUserSession(userId);
    if (!session) return false;

    session.lastActiveAt = Date.now();
    await this.redis.setJson(
      this.getUserSessionKey(userId),
      session,
      ttlSeconds,
    );
    return true;
  }

  /**
   * 사용자 세션 삭제
   */
  async deleteUserSession(userId: string): Promise<boolean> {
    const result = await this.redis.del(this.getUserSessionKey(userId));
    return result > 0;
  }

  /**
   * 사용자가 방에 참가
   */
  async joinRoom(userId: string, roomName: string): Promise<void> {
    const session = await this.getUserSession(userId);
    if (session) {
      session.roomName = roomName;
      session.lastActiveAt = Date.now();
      await this.redis.setJson(
        this.getUserSessionKey(userId),
        session,
        this.DEFAULT_TTL,
      );
    }

    // Room 세션에 참가자 추가
    await this.addParticipantToRoom(roomName, userId);
  }

  /**
   * 사용자가 방에서 퇴장
   */
  async leaveRoom(userId: string, roomName: string): Promise<void> {
    const session = await this.getUserSession(userId);
    if (session && session.roomName === roomName) {
      session.roomName = undefined;
      session.lastActiveAt = Date.now();
      await this.redis.setJson(
        this.getUserSessionKey(userId),
        session,
        this.DEFAULT_TTL,
      );
    }

    // Room 세션에서 참가자 제거
    await this.removeParticipantFromRoom(roomName, userId);
  }

  // ==================== 방 세션 ====================

  /**
   * 방 세션 생성
   */
  async createRoomSession(
    roomName: string,
    metadata?: Record<string, any>,
    ttlSeconds: number = this.DEFAULT_TTL * 24, // 24시간
  ): Promise<RoomSession> {
    const session: RoomSession = {
      roomName,
      createdAt: Date.now(),
      participants: [],
      metadata,
    };

    await this.redis.setJson(
      this.getRoomSessionKey(roomName),
      session,
      ttlSeconds,
    );

    return session;
  }

  /**
   * 방 세션 조회
   */
  async getRoomSession(roomName: string): Promise<RoomSession | null> {
    return this.redis.getJson<RoomSession>(this.getRoomSessionKey(roomName));
  }

  /**
   * 방 세션 삭제
   */
  async deleteRoomSession(roomName: string): Promise<boolean> {
    const result = await this.redis.del(this.getRoomSessionKey(roomName));
    return result > 0;
  }

  /**
   * 방에 참가자 추가
   */
  async addParticipantToRoom(roomName: string, userId: string): Promise<void> {
    let session = await this.getRoomSession(roomName);
    if (!session) {
      session = await this.createRoomSession(roomName);
    }

    if (!session.participants.includes(userId)) {
      session.participants.push(userId);
      await this.redis.setJson(
        this.getRoomSessionKey(roomName),
        session,
        this.DEFAULT_TTL * 24,
      );
    }
  }

  /**
   * 방에서 참가자 제거
   */
  async removeParticipantFromRoom(
    roomName: string,
    userId: string,
  ): Promise<void> {
    const session = await this.getRoomSession(roomName);
    if (!session) return;

    session.participants = session.participants.filter((p) => p !== userId);
    await this.redis.setJson(
      this.getRoomSessionKey(roomName),
      session,
      this.DEFAULT_TTL * 24,
    );
  }

  /**
   * 방 참가자 목록 조회
   */
  async getRoomParticipants(roomName: string): Promise<string[]> {
    const session = await this.getRoomSession(roomName);
    return session?.participants || [];
  }

  /**
   * 활성 방 목록 조회
   */
  async getActiveRooms(): Promise<string[]> {
    const keys = await this.redis.keys(`${this.ROOM_SESSION_PREFIX}*`);
    return keys.map((key) => key.replace(this.ROOM_SESSION_PREFIX, ''));
  }

  // ==================== 헬퍼 ====================

  private getUserSessionKey(userId: string): string {
    return `${this.USER_SESSION_PREFIX}${userId}`;
  }

  private getRoomSessionKey(roomName: string): string {
    return `${this.ROOM_SESSION_PREFIX}${roomName}`;
  }
}
