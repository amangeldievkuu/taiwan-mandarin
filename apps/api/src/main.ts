import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ENV, type Env } from './config/env.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
const env = app.get<Env>(ENV);

app.set('trust proxy', 1);
app.useBodyParser('json', { limit: '10mb' }); // a first sync can carry thousands of cards
app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false }));
app.use(cookieParser());
app.enableCors({ origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()), credentials: true });
app.enableShutdownHooks();

const docs = new DocumentBuilder()
  .setTitle('臺灣華語 API')
  .setDescription(
    'Taiwan Mandarin learning API: the TOCFL word path, a CC-CEDICT dictionary with Taiwan readings, ' +
      'segmentation, graded readers, and (with a personal access token) your cards, reviews and stats.',
  )
  .setVersion('1')
  .addBearerAuth({
    type: 'http',
    scheme: 'bearer',
    description: 'Session JWT or personal access token (tm_…)',
  })
  .build();
SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, docs), {
  jsonDocumentUrl: 'docs/openapi.json',
});

await app.listen(env.PORT);
