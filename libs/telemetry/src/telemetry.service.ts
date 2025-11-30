import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { TELEMETRY_OPTIONS } from './telemetry.constants';
import { TelemetryModuleOptions } from './telemetry.interface';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private sdk: NodeSDK | null = null;
  private initialized = false;

  constructor(
    @Optional()
    @Inject(TELEMETRY_OPTIONS)
    private readonly options?: TelemetryModuleOptions,
  ) {
    if (this.options) {
      this.initFromOptions(this.options);
    }
  }

  private initFromOptions(options: TelemetryModuleOptions): void {
    if (this.initialized) {
      return;
    }

    const {
      serviceName,
      serviceVersion,
      enabled = false,
      endpoint = 'http://localhost:4318/v1/traces',
      environment = 'development',
    } = options;

    if (!enabled) {
      this.logger.log(`OpenTelemetry is disabled for ${serviceName}`);
      return;
    }

    const traceExporter = new OTLPTraceExporter({
      url: endpoint,
    });

    this.sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
        'service.namespace': 'livekit-microservices',
        'deployment.environment': environment,
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-amqplib': {
            enabled: true,
          },
        }),
      ],
    });

    this.sdk.start();
    this.initialized = true;
    this.logger.log(
      `OpenTelemetry initialized for ${serviceName} (${serviceVersion})`,
    );

    process.on('SIGTERM', () => {
      this.shutdown()
        .then(() => this.logger.log('OpenTelemetry shut down'))
        .catch((err) =>
          this.logger.error('Error shutting down OpenTelemetry', err),
        )
        .finally(() => process.exit(0));
    });
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
