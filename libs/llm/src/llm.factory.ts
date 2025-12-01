import { Logger } from '@nestjs/common';
import {
  ILLMProvider,
  LLMProviderOptions,
} from './llm.interface';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';

export class LLMProviderFactory {
  private static readonly logger = new Logger(LLMProviderFactory.name);

  static create(options: LLMProviderOptions): ILLMProvider {
    this.logger.log(`Creating LLM provider: ${options.type}`);

    switch (options.type) {
      case 'ollama':
        return new OllamaProvider(options);
      case 'openai':
        return new OpenAIProvider(options);
      case 'claude':
        return new ClaudeProvider(options);
      case 'gemini':
        return new GeminiProvider(options);
      default:
        throw new Error(`Unknown LLM provider type: ${(options as any).type}`);
    }
  }
}
