import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ description: 'Room name', example: 'my-room' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Maximum participants', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Empty room timeout in seconds', default: 300 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  emptyTimeout?: number;

  @ApiPropertyOptional({ description: 'Room metadata as JSON string' })
  @IsOptional()
  @IsString()
  metadata?: string;
}
