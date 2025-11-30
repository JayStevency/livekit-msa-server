import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LivekitService } from './livekit.service';
import { LIVEKIT_OPTIONS } from './livekit.constants';
import { LivekitModuleOptions, LivekitModuleAsyncOptions } from './livekit.interface';
import { ConfigProps } from '@app/core';

@Global()
@Module({})
export class LivekitModule {
  static forRoot(options: LivekitModuleOptions): DynamicModule {
    return {
      module: LivekitModule,
      providers: [
        {
          provide: LIVEKIT_OPTIONS,
          useValue: options,
        },
        LivekitService,
      ],
      exports: [LivekitService],
    };
  }

  static forRootAsync(options?: LivekitModuleAsyncOptions): DynamicModule {
    const asyncProviders = options?.useFactory
      ? [
          {
            provide: LIVEKIT_OPTIONS,
            useFactory: options.useFactory,
            inject: options.inject || [],
          },
        ]
      : [
          {
            provide: LIVEKIT_OPTIONS,
            useFactory: (configService: ConfigService<ConfigProps>) => {
              const livekit = configService.get('livekit');
              return {
                apiKey: livekit?.apiKey || '',
                apiSecret: livekit?.apiSecret || '',
                wsUrl: livekit?.wsUrl || 'ws://localhost:7880',
              };
            },
            inject: [ConfigService],
          },
        ];

    return {
      module: LivekitModule,
      imports: options?.imports || [ConfigModule],
      providers: [...asyncProviders, LivekitService],
      exports: [LivekitService],
    };
  }
}
