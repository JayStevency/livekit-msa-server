import { ModuleMetadata } from '@nestjs/common';

export type LLMProviderType = 'ollama' | 'openai' | 'claude' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ILLMProvider {
  chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;
  getModelName(): string;
  getProviderType(): LLMProviderType;
}

export interface OllamaProviderOptions {
  type: 'ollama';
  baseUrl: string;
  model: string;
}

export interface OpenAIProviderOptions {
  type: 'openai';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ClaudeProviderOptions {
  type: 'claude';
  apiKey: string;
  model: string;
}

export interface GeminiProviderOptions {
  type: 'gemini';
  apiKey: string;
  model: string;
}

export type LLMProviderOptions =
  | OllamaProviderOptions
  | OpenAIProviderOptions
  | ClaudeProviderOptions
  | GeminiProviderOptions;

export interface LLMModuleOptions {
  provider: LLMProviderOptions;
}

export interface LLMModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: any[]) => Promise<LLMModuleOptions> | LLMModuleOptions;
  inject?: any[];
}
