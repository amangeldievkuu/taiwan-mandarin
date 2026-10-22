// Streams events as NDJSON (one JSON object per line) for answers that arrive bit by bit. Call it
// after guards, validation and quota checks: errors until then are normal HTTP errors. Once the
// first line is out the status is 200, so later errors are sent as an `error` event instead.

import { HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

const logger = new Logger('Ndjson');

/** Sent when nothing else was for this long, so proxies don't close an idle connection. */
const HEARTBEAT_MS = 10_000;

export async function writeNdjson(
  res: Response,
  events: (signal: AbortSignal) => AsyncIterable<object>,
): Promise<void> {
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  // nginx: pass every line on at once instead of buffering the response.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let last = Date.now();
  const write = (event: object) => {
    res.write(`${JSON.stringify(event)}\n`);
    last = Date.now();
  };
  const heartbeat = setInterval(() => {
    if (Date.now() - last >= HEARTBEAT_MS) write({ type: 'ping' });
  }, HEARTBEAT_MS / 2);
  try {
    for await (const event of events(abort.signal)) {
      if (abort.signal.aborted) break;
      write(event);
    }
  } catch (error) {
    if (!abort.signal.aborted) write(errorEvent(error));
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

function errorEvent(error: unknown): { type: 'error'; status: number; message: string } {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
    return {
      type: 'error',
      status: error.getStatus(),
      message: Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : error.message,
    };
  }
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  return { type: 'error', status: 500, message: 'Something went wrong. Try again.' };
}
