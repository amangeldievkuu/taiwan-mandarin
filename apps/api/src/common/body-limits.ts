// How large a JSON body each route may send. Only three need more than a small form does: a first
// sync (thousands of cards), a photo to explain and a recording to check.

import type { IncomingMessage } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';

const LARGE_ROUTES = /^\/v1\/(sync|ai\/explain|speech\/check)(\/|\?|$)/;
const LARGE_LIMIT = '10mb';
const SMALL_LIMIT = '100kb';

const isJson = (req: IncomingMessage) =>
  (req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');
const isLarge = (req: IncomingMessage) => LARGE_ROUTES.test(req.url ?? '');

/** For an app created with `{ bodyParser: false }`. */
export function applyBodyLimits(app: NestExpressApplication): void {
  app.useBodyParser('json', {
    limit: LARGE_LIMIT,
    type: (req: IncomingMessage) => isJson(req) && isLarge(req),
  });
  app.useBodyParser('json', {
    limit: SMALL_LIMIT,
    type: (req: IncomingMessage) => isJson(req) && !isLarge(req),
  });
}
