export interface DatabaseProps {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

export interface RedisProps {
  host: string;
  port: number;
}

export interface RabbitMqProps {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface TelemetryProps {
  enabled: boolean;
  endpoint: string;
}

export interface LokiProps {
  enabled: boolean;
  host: string;
}

export interface LiveKitProps {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
}

export type LLMProviderType = 'ollama' | 'openai' | 'claude';

export interface LLMProps {
  provider: LLMProviderType;
  ollama?: {
    baseUrl: string;
    model: string;
  };
  openai?: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  claude?: {
    apiKey: string;
    model: string;
  };
}

export interface ConfigProps {
  environment: string;
  appName: string;
  version: string;
  gatewayPort: number;
  databaseUrl: string;
  database: DatabaseProps;
  rabbitMqUrl: string;
  rabbitmq: RabbitMqProps;
  redis?: RedisProps;
  telemetry: TelemetryProps;
  loki: LokiProps;
  livekit: LiveKitProps;
  llm?: LLMProps;
  logLevel: string;
}
