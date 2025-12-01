import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER } from './llm.constants';
import {
  ILLMProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  LLMProviderType,
} from './llm.interface';

@Injectable()
export class LLMService implements ILLMProvider {
  private readonly logger = new Logger(LLMService.name);

  constructor(
    @Inject(LLM_PROVIDER)
    private readonly provider: ILLMProvider,
  ) {
    this.logger.log(
      `LLMService initialized with provider: ${provider.getProviderType()}, model: ${provider.getModelName()}`,
    );
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    return this.provider.chat(options);
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  getProviderType(): LLMProviderType {
    return this.provider.getProviderType();
  }
}
