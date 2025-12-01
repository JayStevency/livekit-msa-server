import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ClaudeProviderOptions,
  LLMProviderType,
  ChatMessage,
} from '../llm.interface';

@Injectable()
export class ClaudeProvider implements ILLMProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://api.anthropic.com/v1';

  constructor(options: ClaudeProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.logger.log(`Initialized Claude provider: model: ${this.model}`);
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { systemPrompt, messages } = this.extractSystemPrompt(options.messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content =
      result.content?.[0]?.type === 'text' ? result.content[0].text : '';

    return {
      content,
      model: result.model || this.model,
      usage: result.usage
        ? {
            promptTokens: result.usage.input_tokens,
            completionTokens: result.usage.output_tokens,
            totalTokens: result.usage.input_tokens + result.usage.output_tokens,
          }
        : undefined,
    };
  }

  private extractSystemPrompt(messages: ChatMessage[]): {
    systemPrompt: string | undefined;
    messages: ChatMessage[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    return {
      systemPrompt: systemMessages.map((m) => m.content).join('\n') || undefined,
      messages: otherMessages,
    };
  }

  getModelName(): string {
    return this.model;
  }

  getProviderType(): LLMProviderType {
    return 'claude';
  }
}
