import { DynamicModule, Global, Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TELEMETRY_OPTIONS } from './telemetry.constants';
import {
  TelemetryModuleOptions,
  TelemetryModuleAsyncOptions,
} from './telemetry.interface';

@Global()
@Module({
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {
  static forRoot(options: TelemetryModuleOptions): DynamicModule {
    return {
      module: TelemetryModule,
      providers: [
        {
          provide: TELEMETRY_OPTIONS,
          useValue: options,
        },
        TelemetryService,
      ],
      exports: [TelemetryService],
    };
  }

  static forRootAsync(options: TelemetryModuleAsyncOptions): DynamicModule {
    return {
      module: TelemetryModule,
      imports: options.imports || [],
      providers: [
        {
          provide: TELEMETRY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        TelemetryService,
      ],
      exports: [TelemetryService],
    };
  }
}
