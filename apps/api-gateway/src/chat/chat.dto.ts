import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({ description: 'User message', example: '안녕하세요' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Conversation ID for context',
    example: 'conv-123',
  })
  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'AI response message' })
  message: string;

  @ApiProperty({ description: 'Conversation ID' })
  conversationId: string;

  @ApiProperty({ description: 'Model used' })
  model: string;
}
