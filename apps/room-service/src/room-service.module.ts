import { Module } from '@nestjs/common';
import { CoreModule } from '@app/core';
import { RabbitmqModule } from '@app/rabbitmq';
import { PrismaModule } from '@app/prisma';
import { LivekitModule } from '@app/livekit';
import { LIVEKIT_SERVICE, LIVEKIT_QUEUE } from '@app/shared';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    CoreModule.forRoot('room-service'),
    RabbitmqModule,
    RabbitmqModule.register({
      name: LIVEKIT_SERVICE,
      queue: LIVEKIT_QUEUE,
    }),
    PrismaModule,
    LivekitModule.forRootAsync(),
    RoomsModule,
  ],
})
export class RoomServiceModule {}
