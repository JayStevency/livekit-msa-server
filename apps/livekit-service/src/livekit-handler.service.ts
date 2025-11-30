import { Injectable, Logger } from '@nestjs/common';
import { TrackSource } from 'livekit-server-sdk';
import { LivekitService, CreateTokenOptions } from '@app/livekit';
import {
  RpcResponse,
  createSuccessResponse,
  createErrorResponse,
} from '@app/shared';

@Injectable()
export class LivekitHandlerService {
  private readonly logger = new Logger(LivekitHandlerService.name);

  constructor(private readonly livekitService: LivekitService) {}

  async createToken(options: CreateTokenOptions): Promise<RpcResponse> {
    try {
      const token = await this.livekitService.createToken(options);
      return createSuccessResponse({
        token,
        wsUrl: this.livekitService.getWsUrl(),
        roomName: options.roomName,
        identity: options.identity,
      });
    } catch (error) {
      this.logger.error(`Failed to create token: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async createRoom(data: {
    name: string;
    emptyTimeout?: number;
    maxParticipants?: number;
    metadata?: string;
  }): Promise<RpcResponse> {
    try {
      const room = await this.livekitService.createRoom(
        data.name,
        data.emptyTimeout,
        data.maxParticipants,
        data.metadata,
      );
      return createSuccessResponse(room);
    } catch (error) {
      this.logger.error(`Failed to create room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async deleteRoom(name: string): Promise<RpcResponse> {
    try {
      await this.livekitService.deleteRoom(name);
      return createSuccessResponse({ deleted: true });
    } catch (error) {
      this.logger.error(`Failed to delete room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async listRooms(names?: string[]): Promise<RpcResponse> {
    try {
      const rooms = await this.livekitService.listRooms(names);
      return createSuccessResponse(rooms);
    } catch (error) {
      this.logger.error(`Failed to list rooms: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async getRoom(name: string): Promise<RpcResponse> {
    try {
      const room = await this.livekitService.getRoom(name);
      if (!room) {
        return createErrorResponse(`Room ${name} not found`);
      }
      return createSuccessResponse(room);
    } catch (error) {
      this.logger.error(`Failed to get room: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async listParticipants(roomName: string): Promise<RpcResponse> {
    try {
      const participants =
        await this.livekitService.listParticipants(roomName);
      return createSuccessResponse(participants);
    } catch (error) {
      this.logger.error(`Failed to list participants: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async removeParticipant(
    roomName: string,
    identity: string,
  ): Promise<RpcResponse> {
    try {
      await this.livekitService.removeParticipant(roomName, identity);
      return createSuccessResponse({ removed: true });
    } catch (error) {
      this.logger.error(`Failed to remove participant: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  async muteParticipant(
    roomName: string,
    identity: string,
    trackSource: string,
    muted: boolean,
  ): Promise<RpcResponse> {
    try {
      const source = this.parseTrackSource(trackSource);
      await this.livekitService.muteParticipant(
        roomName,
        identity,
        source,
        muted,
      );
      return createSuccessResponse({ muted });
    } catch (error) {
      this.logger.error(`Failed to mute participant: ${error.message}`);
      return createErrorResponse(error.message);
    }
  }

  private parseTrackSource(source: string): TrackSource {
    switch (source.toUpperCase()) {
      case 'CAMERA':
        return TrackSource.CAMERA;
      case 'MICROPHONE':
        return TrackSource.MICROPHONE;
      case 'SCREEN_SHARE':
        return TrackSource.SCREEN_SHARE;
      case 'SCREEN_SHARE_AUDIO':
        return TrackSource.SCREEN_SHARE_AUDIO;
      default:
        return TrackSource.UNKNOWN;
    }
  }
}
