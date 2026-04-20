import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module.js';

async function bootstrap() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = process.env.HOST || 'localhost';
  const globalPrefix = process.env.API_PREFIX || 'api';

  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Backslash Graph Query Engine')
    .setDescription(
      'RESTful API for querying a microservices graph with composable filters',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/docs', app, document);

  app.enableCors({ origin: true });
  app.setGlobalPrefix(globalPrefix);

  await app.listen(port, host);

  console.log(`\nAPI:   http://${host}:${port}/${globalPrefix}`);
  console.log(`Docs:  http://${host}:${port}/docs\n`);
}

bootstrap();
