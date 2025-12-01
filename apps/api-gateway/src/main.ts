import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ConfigProps } from '@app/core';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Serve static files (test-client.html)
  // In Docker: __dirname = /app/dist/apps/api-gateway/apps/api-gateway/src
  // public folder is at /app/public
  app.useStaticAssets(join(__dirname, '..', '..', '..', '..', '..', '..', 'public'), {
    prefix: '/',
  });

  const config = new DocumentBuilder()
    .setTitle('LiveKit MSA API')
    .setDescription('LiveKit MSA Server API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const configService = app.get(ConfigService<ConfigProps>);
  const port = configService.get('gatewayPort') || 3000;

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`API Gateway is running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api`);
}

bootstrap();
