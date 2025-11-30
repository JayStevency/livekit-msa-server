import { Module } from '@nestjs/common';
import { CoreModule } from '@app/core';
import { RabbitmqModule } from '@app/rabbitmq';
import { LIVEKIT_SERVICE, LIVEKIT_QUEUE } from '@app/shared';
import { RoomsModule } from './rooms/rooms.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    CoreModule.forRoot('api-gateway'),
    RabbitmqModule.register({
      name: LIVEKIT_SERVICE,
      queue: LIVEKIT_QUEUE,
    }),
    RoomsModule,
    HealthModule,
  ],
})
export class AppModule {}
