import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { LivekitServiceModule } from './livekit-service.module';
import { RabbitmqService } from '@app/rabbitmq';
import { LIVEKIT_QUEUE } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(LivekitServiceModule);

  const rmqService = app.get<RabbitmqService>(RabbitmqService);
  app.connectMicroservice<MicroserviceOptions>(
    rmqService.getOptions(LIVEKIT_QUEUE, false),
  );

  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();

  const logger = app.get(Logger);
  logger.log('LiveKit Service is listening on RabbitMQ');
}

bootstrap();
