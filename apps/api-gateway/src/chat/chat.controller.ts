import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatRequestDto, ChatResponseDto } from './chat.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Chat with AI (Ollama LLM)' })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(`Chat request: ${chatRequest.message}`);

    const response = await this.chatService.chat(
      chatRequest.message,
      chatRequest.conversationId,
    );

    this.logger.log(`Chat response: ${response.message.substring(0, 50)}...`);

    return response;
  }

  @Post('clear')
  @ApiOperation({ summary: 'Clear conversation history' })
  @ApiBody({ schema: { properties: { conversationId: { type: 'string' } } } })
  async clearHistory(
    @Body('conversationId') conversationId: string,
  ): Promise<{ success: boolean }> {
    this.chatService.clearHistory(conversationId);
    return { success: true };
  }
}
