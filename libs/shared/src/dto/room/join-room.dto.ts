import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiProperty({ description: 'Room ID or name' })
  @IsString()
  roomName: string;

  @ApiProperty({ description: 'Participant identity (user ID)' })
  @IsString()
  identity: string;

  @ApiPropertyOptional({ description: 'Participant display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Participant metadata' })
  @IsOptional()
  @IsString()
  metadata?: string;

  @ApiPropertyOptional({ description: 'Can publish video', default: true })
  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @ApiPropertyOptional({ description: 'Can subscribe to tracks', default: true })
  @IsOptional()
  @IsBoolean()
  canSubscribe?: boolean;

  @ApiPropertyOptional({ description: 'Can publish data', default: true })
  @IsOptional()
  @IsBoolean()
  canPublishData?: boolean;
}
