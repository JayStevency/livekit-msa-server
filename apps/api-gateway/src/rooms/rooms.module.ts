import { Module } from '@nestjs/common';
import { RabbitmqModule } from '@app/rabbitmq';
import { LIVEKIT_SERVICE, LIVEKIT_QUEUE } from '@app/shared';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [
    RabbitmqModule.register({
      name: LIVEKIT_SERVICE,
      queue: LIVEKIT_QUEUE,
    }),
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
