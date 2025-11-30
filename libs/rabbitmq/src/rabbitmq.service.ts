import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext, RmqOptions, Transport } from '@nestjs/microservices';
import { ConfigProps } from '@app/core';

@Injectable()
export class RabbitmqService {
  constructor(private readonly configService: ConfigService<ConfigProps>) {}

  getOptions(queue: string, noAck = false): RmqOptions {
    const rabbitMqUrl = this.configService.get('rabbitMqUrl');
    return {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitMqUrl],
        queue,
        noAck,
        queueOptions: {
          durable: true,
        },
      },
    };
  }

  ack(context: RmqContext): void {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();
    channel.ack(originalMessage);
  }
}
