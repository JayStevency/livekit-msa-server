import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AccessToken,
  RoomServiceClient,
  Room,
  ParticipantInfo,
  TrackSource,
} from 'livekit-server-sdk';
import { LIVEKIT_OPTIONS } from './livekit.constants';
import { LivekitModuleOptions, CreateTokenOptions } from './livekit.interface';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly roomService: RoomServiceClient;

  constructor(
    @Inject(LIVEKIT_OPTIONS)
    private readonly options: LivekitModuleOptions,
  ) {
    // Convert ws:// to http:// for REST API calls
    const httpUrl = this.options.wsUrl
      .replace('ws://', 'http://')
      .replace('wss://', 'https://');

    this.roomService = new RoomServiceClient(
      httpUrl,
      this.options.apiKey,
      this.options.apiSecret,
    );

    this.logger.log(`LiveKit service initialized with URL: ${httpUrl}`);
  }

  /**
   * Create an access token for a participant to join a room
   */
  async createToken(options: CreateTokenOptions): Promise<string> {
    const {
      roomName,
      identity,
      name,
      metadata,
      canPublish = true,
      canSubscribe = true,
      canPublishData = true,
      ttl = 3600,
    } = options;

    const token = new AccessToken(this.options.apiKey, this.options.apiSecret, {
      identity,
      name,
      metadata,
      ttl,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    });

    const jwt = await token.toJwt();
    this.logger.debug(`Created token for ${identity} in room ${roomName}`);
    return jwt;
  }

  /**
   * Create a new LiveKit room
   */
  async createRoom(
    name: string,
    emptyTimeout?: number,
    maxParticipants?: number,
    metadata?: string,
  ): Promise<Room> {
    const room = await this.roomService.createRoom({
      name,
      emptyTimeout: emptyTimeout || 300,
      maxParticipants: maxParticipants || 10,
      metadata,
    });

    this.logger.log(`Created room: ${name}`);
    return room;
  }

  /**
   * List all rooms
   */
  async listRooms(names?: string[]): Promise<Room[]> {
    const rooms = await this.roomService.listRooms(names);
    return rooms;
  }

  /**
   * Get a specific room by name
   */
  async getRoom(name: string): Promise<Room | null> {
    const rooms = await this.roomService.listRooms([name]);
    return rooms.length > 0 ? rooms[0] : null;
  }

  /**
   * Delete a room
   */
  async deleteRoom(name: string): Promise<void> {
    await this.roomService.deleteRoom(name);
    this.logger.log(`Deleted room: ${name}`);
  }

  /**
   * List participants in a room
   */
  async listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    const participants = await this.roomService.listParticipants(roomName);
    return participants;
  }

  /**
   * Get a specific participant
   */
  async getParticipant(
    roomName: string,
    identity: string,
  ): Promise<ParticipantInfo | null> {
    try {
      const participant = await this.roomService.getParticipant(
        roomName,
        identity,
      );
      return participant;
    } catch {
      return null;
    }
  }

  /**
   * Remove a participant from a room
   */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.roomService.removeParticipant(roomName, identity);
    this.logger.log(`Removed participant ${identity} from room ${roomName}`);
  }

  /**
   * Mute/unmute a participant's track
   */
  async muteParticipant(
    roomName: string,
    identity: string,
    trackSource: TrackSource,
    muted: boolean,
  ): Promise<void> {
    await this.roomService.mutePublishedTrack(
      roomName,
      identity,
      trackSource.toString(),
      muted,
    );
    this.logger.log(
      `${muted ? 'Muted' : 'Unmuted'} ${trackSource} for ${identity} in ${roomName}`,
    );
  }

  /**
   * Update participant metadata
   */
  async updateParticipant(
    roomName: string,
    identity: string,
    metadata?: string,
    name?: string,
  ): Promise<ParticipantInfo> {
    const participant = await this.roomService.updateParticipant(
      roomName,
      identity,
      metadata,
      undefined,
      name,
    );
    return participant;
  }

  /**
   * Update room metadata
   */
  async updateRoomMetadata(roomName: string, metadata: string): Promise<Room> {
    const room = await this.roomService.updateRoomMetadata(roomName, metadata);
    return room;
  }

  /**
   * Get the WebSocket URL for client connection
   */
  getWsUrl(): string {
    return this.options.wsUrl;
  }
}
