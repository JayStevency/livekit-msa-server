import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { RabbitmqService } from '@app/rabbitmq';
import {
  ROOM_CREATE,
  ROOM_FIND_ALL,
  ROOM_FIND_ONE,
  ROOM_UPDATE,
  ROOM_DELETE,
  ROOM_JOIN,
  ROOM_LEAVE,
  RpcResponse,
  CreateRoomDto,
  JoinRoomDto,
} from '@app/shared';
import { RoomsService } from './rooms.service';

@Controller()
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly rmqService: RabbitmqService,
  ) {}

  @MessagePattern(ROOM_CREATE)
  async create(
    @Payload() data: CreateRoomDto,
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.create(data);
  }

  @MessagePattern(ROOM_FIND_ALL)
  async findAll(@Ctx() context: RmqContext): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.findAll();
  }

  @MessagePattern(ROOM_FIND_ONE)
  async findOne(
    @Payload() data: { id: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.findOne(data.id);
  }

  @MessagePattern(ROOM_UPDATE)
  async update(
    @Payload() data: { id: string; updates: Partial<CreateRoomDto> },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.update(data.id, data.updates);
  }

  @MessagePattern(ROOM_DELETE)
  async delete(
    @Payload() data: { id: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.delete(data.id);
  }

  @MessagePattern(ROOM_JOIN)
  async join(
    @Payload() data: JoinRoomDto,
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.join(data);
  }

  @MessagePattern(ROOM_LEAVE)
  async leave(
    @Payload() data: { roomId: string; identity: string },
    @Ctx() context: RmqContext,
  ): Promise<RpcResponse> {
    this.rmqService.ack(context);
    return this.roomsService.leave(data.roomId, data.identity);
  }
}
