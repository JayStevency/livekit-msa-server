import { Injectable, Logger } from '@nestjs/common';
import { LLMService, ChatMessage } from '@app/llm';
import { ChatResponseDto } from './chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly conversations = new Map<string, ChatMessage[]>();

  private readonly systemPrompt = `You are a helpful AI assistant.
You MUST respond ONLY in Korean (한국어).
Never mix other languages like Chinese or Japanese.
Keep your answers concise and clear.`;

  constructor(private readonly llmService: LLMService) {
    this.logger.log(
      `ChatService initialized with provider: ${llmService.getProviderType()}, model: ${llmService.getModelName()}`,
    );
  }

  private logMetric(event: string, durationMs: number, extra: Record<string, any> = {}) {
    const metric = {
      event,
      duration_ms: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
      ...extra,
    };
    this.logger.log(`METRIC: ${JSON.stringify(metric)}`);
  }

  async chat(
    userMessage: string,
    conversationId?: string,
  ): Promise<ChatResponseDto> {
    const convId = conversationId || this.generateConversationId();
    const startTime = Date.now();

    if (!this.conversations.has(convId)) {
      this.conversations.set(convId, []);
    }

    const history = this.conversations.get(convId)!;

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.llmService.chat({ messages });
      const durationMs = Date.now() - startTime;

      // Log LLM response metric
      this.logMetric('llm_response', durationMs, {
        provider: this.llmService.getProviderType(),
        model: this.llmService.getModelName(),
        input_length: userMessage.length,
        output_length: response.content.length,
        history_length: history.length,
      });

      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: response.content });

      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      return {
        message: response.content,
        conversationId: convId,
        model: response.model,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logMetric('llm_error', durationMs, {
        provider: this.llmService.getProviderType(),
        model: this.llmService.getModelName(),
        error: error.message,
      });
      this.logger.error(`Chat error: ${error.message}`);
      throw error;
    }
  }

  clearHistory(conversationId: string): void {
    this.conversations.delete(conversationId);
    this.logger.log(`Cleared history for: ${conversationId}`);
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
