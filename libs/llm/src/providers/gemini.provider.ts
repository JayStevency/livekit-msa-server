import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  GeminiProviderOptions,
  LLMProviderType,
  ChatMessage,
} from '../llm.interface';

@Injectable()
export class GeminiProvider implements ILLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.logger.log(`Initialized Gemini provider: model: ${this.model}`);
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { systemInstruction, contents } = this.convertMessages(options.messages);

    const response = await fetch(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          contents,
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens || 4096,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content =
      result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      model: this.model,
      usage: result.usageMetadata
        ? {
            promptTokens: result.usageMetadata.promptTokenCount || 0,
            completionTokens: result.usageMetadata.candidatesTokenCount || 0,
            totalTokens: result.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  private convertMessages(messages: ChatMessage[]): {
    systemInstruction: string | undefined;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const contents = otherMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    return {
      systemInstruction: systemMessages.map((m) => m.content).join('\n') || undefined,
      contents,
    };
  }

  getModelName(): string {
    return this.model;
  }

  getProviderType(): LLMProviderType {
    return 'gemini';
  }
}
