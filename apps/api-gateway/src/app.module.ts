import { Module } from '@nestjs/common';
import { CoreModule } from '@app/core';
import { RabbitmqModule } from '@app/rabbitmq';
import { RedisModule } from '@app/redis';
import { LLMModule } from '@app/llm';
import { LIVEKIT_SERVICE, LIVEKIT_QUEUE } from '@app/shared';
import { RoomsModule } from './rooms/rooms.module';
import { HealthModule } from './health/health.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    CoreModule.forRoot('api-gateway'),
    RabbitmqModule.register({
      name: LIVEKIT_SERVICE,
      queue: LIVEKIT_QUEUE,
    }),
    RedisModule.forRootAsync(),
    LLMModule.forRootAsync(),
    RoomsModule,
    HealthModule,
    ChatModule,
  ],
})
export class AppModule {}
