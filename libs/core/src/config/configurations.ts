import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfigProps, LLMProviderType, LLMProps } from './config.type';

const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
);

export default (): ConfigProps => {
  let data: Record<string, string> = {};
  const environment: string = process.env.NODE_ENV || 'local';

  // Load environment-specific .env file
  const envFiles = [`.env.${environment}`, '.env.local', '.env'];
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      Object.assign(data, dotenv.parse(fs.readFileSync(envFile)));
      break;
    }
  }

  // Merge with process.env (process.env takes priority)
  data = { ...data, ...process.env };

  // Database configuration
  const dbHost = data.DB_HOST || 'localhost';
  const dbPort = parseInt(data.DB_PORT, 10) || 5432;
  const dbUsername = data.DB_USERNAME || data.POSTGRES_USER || 'postgres';
  const dbPassword = data.DB_PASSWORD || data.POSTGRES_PASSWORD || 'postgres';
  const dbName = data.DB_NAME || data.POSTGRES_DB || 'livekit';
  const databaseUrl =
    data.DATABASE_URL ||
    `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?schema=public`;

  // RabbitMQ configuration
  const rabbitHost = data.RABBITMQ_HOST || 'localhost';
  const rabbitPort = parseInt(data.RABBITMQ_PORT, 10) || 5672;
  const rabbitUsername = data.RABBITMQ_USER || data.RABBITMQ_DEFAULT_USER || 'guest';
  const rabbitPassword = data.RABBITMQ_PASS || data.RABBITMQ_DEFAULT_PASS || 'guest';
  const rabbitMqUrl =
    data.RABBITMQ_URL ||
    `amqp://${rabbitUsername}:${rabbitPassword}@${rabbitHost}:${rabbitPort}`;

  // Redis configuration
  const redisHost = data.REDIS_HOST;
  const redisPort = data.REDIS_PORT ? parseInt(data.REDIS_PORT, 10) : undefined;

  return {
    environment,
    appName: data.npm_package_name || packageJson.name,
    version: data.npm_package_version || packageJson.version,
    gatewayPort: parseInt(data.APP_PORT || data.PORT, 10) || 3000,
    databaseUrl,
    database: {
      host: dbHost,
      port: dbPort,
      username: dbUsername,
      password: dbPassword,
      name: dbName,
    },
    rabbitMqUrl,
    rabbitmq: {
      host: rabbitHost,
      port: rabbitPort,
      username: rabbitUsername,
      password: rabbitPassword,
    },
    redis: redisHost
      ? {
          host: redisHost,
          port: redisPort || 6379,
        }
      : undefined,
    telemetry: {
      enabled: data.OTEL_ENABLED === 'true',
      endpoint:
        data.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    },
    loki: {
      enabled: data.LOKI_ENABLED === 'true',
      host: data.LOKI_HOST || 'http://localhost:3100',
    },
    livekit: {
      apiKey: data.LIVEKIT_API_KEY || '',
      apiSecret: data.LIVEKIT_API_SECRET || '',
      wsUrl: data.LIVEKIT_WS_URL || 'ws://localhost:7880',
    },
    llm: buildLLMConfig(data),
    logLevel: data.LOG_LEVEL || 'info',
  };
};

function buildLLMConfig(data: Record<string, string>): LLMProps | undefined {
  const provider = (data.LLM_PROVIDER || 'ollama') as LLMProviderType;

  const config: LLMProps = {
    provider,
  };

  if (provider === 'ollama' || data.OLLAMA_BASE_URL || data.OLLAMA_MODEL) {
    config.ollama = {
      baseUrl: data.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: data.OLLAMA_MODEL || 'llama3.2:3b',
    };
  }

  if (provider === 'openai' || data.OPENAI_API_KEY) {
    config.openai = {
      apiKey: data.OPENAI_API_KEY || '',
      model: data.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: data.OPENAI_BASE_URL,
    };
  }

  if (provider === 'claude' || data.ANTHROPIC_API_KEY) {
    config.claude = {
      apiKey: data.ANTHROPIC_API_KEY || '',
      model: data.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    };
  }

  return config;
}

export { default as configurations } from './configurations';
