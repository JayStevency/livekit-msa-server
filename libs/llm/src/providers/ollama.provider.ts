import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  OllamaProviderOptions,
  LLMProviderType,
} from '../llm.interface';

@Injectable()
export class OllamaProvider implements ILLMProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OllamaProviderOptions) {
    this.baseUrl = options.baseUrl;
    this.model = options.model;
    this.logger.log(`Initialized Ollama provider: ${this.baseUrl}, model: ${this.model}`);
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        stream: options.stream ?? false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.message?.content || '';

    return {
      content,
      model: this.model,
      usage: result.eval_count
        ? {
            promptTokens: result.prompt_eval_count || 0,
            completionTokens: result.eval_count || 0,
            totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
          }
        : undefined,
    };
  }

  getModelName(): string {
    return this.model;
  }

  getProviderType(): LLMProviderType {
    return 'ollama';
  }
}
