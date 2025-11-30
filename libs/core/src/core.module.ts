import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configurations from './config/configurations';
import { ConfigProps } from './config/config.type';
import { TelemetryModule } from '@app/telemetry';

interface PinoTarget {
  target: string;
  options: Record<string, unknown>;
  level: string;
}

const getPinoTransport = (
  serviceName: string,
  environment: string,
  loki: { enabled: boolean; host: string },
) => {
  // In production, use JSON stdout logging (no transport workers for better compatibility)
  // Note: For Loki integration in production, use a log collector sidecar (e.g., Promtail)
  if (environment === 'production') {
    return undefined;
  }

  // In development/local, use pino-pretty for readable logs
  const targets: PinoTarget[] = [
    {
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'debug',
    },
  ];

  // Add Loki transport in non-production if enabled
  if (loki.enabled) {
    targets.push({
      target: 'pino-loki',
      options: {
        batching: true,
        interval: 5,
        host: loki.host,
        labels: {
          app: serviceName,
          env: environment,
        },
        silenceErrors: false,
      },
      level: 'info',
    });
  }

  return { targets };
};

@Global()
@Module({})
export class CoreModule {
  static forRoot(serviceName: string): DynamicModule {
    // Load config synchronously for initial setup
    const config = configurations();

    return {
      module: CoreModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configurations],
          envFilePath: ['.env.local', '.env.dev', '.env.prod', '.env'],
        }),
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.logLevel,
            transport: getPinoTransport(serviceName, config.environment, config.loki),
          },
        }),
        TelemetryModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<ConfigProps>) => {
            const telemetry = configService.get('telemetry');
            return {
              serviceName,
              serviceVersion: configService.get('version') || '0.0.0',
              enabled: telemetry?.enabled || false,
              endpoint: telemetry?.endpoint,
              environment: configService.get('environment'),
            };
          },
        }),
      ],
      exports: [ConfigModule, TelemetryModule],
    };
  }
}
