import { Module } from '@nestjs/common';
import { CoreModule } from '@app/core';
import { RabbitmqModule } from '@app/rabbitmq';
import { LivekitModule } from '@app/livekit';
import { LivekitServiceController } from './livekit-service.controller';
import { LivekitHandlerService } from './livekit-handler.service';

@Module({
  imports: [
    CoreModule.forRoot('livekit-service'),
    RabbitmqModule,
    LivekitModule.forRootAsync(),
  ],
  controllers: [LivekitServiceController],
  providers: [LivekitHandlerService],
})
export class LivekitServiceModule {}
