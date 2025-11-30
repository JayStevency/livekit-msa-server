import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { RoomServiceModule } from './room-service.module';
import { RabbitmqService } from '@app/rabbitmq';
import { ROOM_QUEUE } from '@app/shared';

async function bootstrap() {
  const app = await NestFactory.create(RoomServiceModule);

  const rmqService = app.get<RabbitmqService>(RabbitmqService);
  app.connectMicroservice<MicroserviceOptions>(
    rmqService.getOptions(ROOM_QUEUE, false),
  );

  app.useLogger(app.get(Logger));

  await app.startAllMicroservices();

  const logger = app.get(Logger);
  logger.log('Room Service is listening on RabbitMQ');
}

bootstrap();
