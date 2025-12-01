import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LLM_OPTIONS, LLM_PROVIDER } from './llm.constants';
import { LLMModuleOptions, LLMModuleAsyncOptions } from './llm.interface';
import { LLMProviderFactory } from './llm.factory';
import { LLMService } from './llm.service';

@Global()
@Module({})
export class LLMModule {
  static forRoot(options: LLMModuleOptions): DynamicModule {
    const provider = LLMProviderFactory.create(options.provider);

    return {
      module: LLMModule,
      providers: [
        {
          provide: LLM_OPTIONS,
          useValue: options,
        },
        {
          provide: LLM_PROVIDER,
          useValue: provider,
        },
        LLMService,
      ],
      exports: [LLMService, LLM_PROVIDER],
    };
  }

  static forRootAsync(options?: LLMModuleAsyncOptions): DynamicModule {
    const asyncProviders = options?.useFactory
      ? [
          {
            provide: LLM_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject || [],
          },
        ]
      : [
          {
            provide: LLM_OPTIONS,
            useFactory: (configService: ConfigService): LLMModuleOptions => {
              const providerType = configService.get<string>('LLM_PROVIDER') || 'ollama';

              if (providerType === 'openai') {
                return {
                  provider: {
                    type: 'openai',
                    apiKey: configService.get<string>('OPENAI_API_KEY') || '',
                    model: configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini',
                    baseUrl: configService.get<string>('OPENAI_BASE_URL'),
                  },
                };
              }

              if (providerType === 'claude') {
                return {
                  provider: {
                    type: 'claude',
                    apiKey: configService.get<string>('ANTHROPIC_API_KEY') || '',
                    model: configService.get<string>('CLAUDE_MODEL') || 'claude-sonnet-4-20250514',
                  },
                };
              }

              if (providerType === 'gemini') {
                return {
                  provider: {
                    type: 'gemini',
                    apiKey: configService.get<string>('GEMINI_API_KEY') || '',
                    model: configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash',
                  },
                };
              }

              // Default to Ollama
              return {
                provider: {
                  type: 'ollama',
                  baseUrl: configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434',
                  model: configService.get<string>('OLLAMA_MODEL') || 'llama3.2:3b',
                },
              };
            },
            inject: [ConfigService],
          },
        ];

    return {
      module: LLMModule,
      imports: options?.imports || [ConfigModule],
      providers: [
        ...asyncProviders,
        {
          provide: LLM_PROVIDER,
          useFactory: (llmOptions: LLMModuleOptions) => {
            return LLMProviderFactory.create(llmOptions.provider);
          },
          inject: [LLM_OPTIONS],
        },
        LLMService,
      ],
      exports: [LLMService, LLM_PROVIDER],
    };
  }
}
