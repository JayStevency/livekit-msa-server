import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { RabbitmqService } from '@app/rabbitmq';
import {
  LIVEKIT_CREATE_TOKEN,
  LIVEKIT_CREATE_ROOM,
  LIVEKIT_DELETE_ROOM,
  LIVEKIT_LIST_ROOMS,
  LIVEKIT_GET_ROOM,
  LIVEKIT_LIST_PARTICIPANTS,
  LIVEKIT_REMOVE_PARTICIPANT,
  LIVEKIT_MUTE_PARTICIPANT,
  RpcResponse,
} from '@app/shared';
import { LivekitHandlerService } from './livekit-handler.service';

@Controller()
export class LivekitServiceController {
  constructor(
    private readonly livekitHandler: LivekitHandlerService,
    private readonly rmqService: RabbitmqService,
  ) {}

  @MessagePattern(LIVEKIT_CREATE_TOKEN)
  async createToken(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.createToken(data);
  }

  @MessagePattern(LIVEKIT_CREATE_ROOM)
  async createRoom(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.createRoom(data);
  }

  @MessagePattern(LIVEKIT_DELETE_ROOM)
  async deleteRoom(
    @Payload() data: { name: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.deleteRoom(data.name);
  }

  @MessagePattern(LIVEKIT_LIST_ROOMS)
  async listRooms(
    @Payload() data: { names?: string[] },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.listRooms(data?.names);
  }

  @MessagePattern(LIVEKIT_GET_ROOM)
  async getRoom(
    @Payload() data: { name: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.getRoom(data.name);
  }

  @MessagePattern(LIVEKIT_LIST_PARTICIPANTS)
  async listParticipants(
    @Payload() data: { roomName: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.listParticipants(data.roomName);
  }

  @MessagePattern(LIVEKIT_REMOVE_PARTICIPANT)
  async removeParticipant(
    @Payload() data: { roomName: string; identity: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.removeParticipant(data.roomName, data.identity);
  }

  @MessagePattern(LIVEKIT_MUTE_PARTICIPANT)
  async muteParticipant(
    @Payload()
    data: {
      roomName: string;
      identity: string;
      trackSource: string;
      muted: boolean;
    },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.livekitHandler.muteParticipant(
      data.roomName,
      data.identity,
      data.trackSource,
      data.muted,
    );
  }
}
