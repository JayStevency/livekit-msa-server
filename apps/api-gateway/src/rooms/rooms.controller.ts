import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, JoinRoomDto, RpcResponse } from '@app/shared';

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  async createRoom(@Body() createRoomDto: CreateRoomDto) {
    const result = await this.roomsService.createRoom(createRoomDto);
    return this.handleResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'List all rooms' })
  @ApiQuery({ name: 'names', required: false, type: [String] })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  async listRooms(@Query('names') names?: string | string[]) {
    const nameArray = names
      ? Array.isArray(names)
        ? names
        : [names]
      : undefined;
    const result = await this.roomsService.listRooms(nameArray);
    return this.handleResponse(result);
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get a specific room' })
  @ApiParam({ name: 'name', description: 'Room name' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully' })
  async getRoom(@Param('name') name: string) {
    const result = await this.roomsService.getRoom(name);
    return this.handleResponse(result);
  }

  @Delete(':name')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'name', description: 'Room name' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  async deleteRoom(@Param('name') name: string) {
    const result = await this.roomsService.deleteRoom(name);
    return this.handleResponse(result);
  }

  @Post(':name/join')
  @ApiOperation({ summary: 'Join a room and get access token' })
  @ApiParam({ name: 'name', description: 'Room name' })
  @ApiResponse({ status: 200, description: 'Token generated successfully' })
  async joinRoom(@Param('name') name: string, @Body() joinDto: JoinRoomDto) {
    const result = await this.roomsService.joinRoom({
      ...joinDto,
      roomName: name,
    });
    return this.handleResponse(result);
  }

  @Get(':name/participants')
  @ApiOperation({ summary: 'List participants in a room' })
  @ApiParam({ name: 'name', description: 'Room name' })
  @ApiResponse({
    status: 200,
    description: 'Participants retrieved successfully',
  })
  async listParticipants(@Param('name') name: string) {
    const result = await this.roomsService.listParticipants(name);
    return this.handleResponse(result);
  }

  @Delete(':name/participants/:identity')
  @ApiOperation({ summary: 'Remove a participant from a room' })
  @ApiParam({ name: 'name', description: 'Room name' })
  @ApiParam({ name: 'identity', description: 'Participant identity' })
  @ApiResponse({
    status: 200,
    description: 'Participant removed successfully',
  })
  async removeParticipant(
    @Param('name') name: string,
    @Param('identity') identity: string,
  ) {
    const result = await this.roomsService.removeParticipant(name, identity);
    return this.handleResponse(result);
  }

  @Post(':name/participants/:identity/mute')
  @ApiOperation({ summary: 'Mute/unmute a participant' })
  @ApiParam({ name: 'name', description: 'Room name' })
  @ApiParam({ name: 'identity', description: 'Participant identity' })
  @ApiResponse({
    status: 200,
    description: 'Participant mute status updated',
  })
  async muteParticipant(
    @Param('name') name: string,
    @Param('identity') identity: string,
    @Body() body: { trackSource: string; muted: boolean },
  ) {
    const result = await this.roomsService.muteParticipant(
      name,
      identity,
      body.trackSource,
      body.muted,
    );
    return this.handleResponse(result);
  }

  private handleResponse(response: RpcResponse) {
    if (!response.success) {
      throw new HttpException(
        response.error || 'Internal server error',
        HttpStatus.BAD_REQUEST,
      );
    }
    return response.data;
  }
}
