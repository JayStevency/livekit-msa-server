import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitmqService } from './rabbitmq.service';
import { ConfigProps } from '@app/core';

export interface RmqModuleOptions {
  name: string;
  queue: string;
}

@Module({
  providers: [RabbitmqService],
  exports: [RabbitmqService],
})
export class RabbitmqModule {
  static register(options: RmqModuleOptions): DynamicModule {
    return {
      module: RabbitmqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: options.name,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService<ConfigProps>) => {
              const rabbitMqUrl = configService.get('rabbitMqUrl');
              return {
                transport: Transport.RMQ,
                options: {
                  urls: [rabbitMqUrl] as string[],
                  queue: options.queue,
                  queueOptions: {
                    durable: true,
                  },
                },
              };
            },
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
