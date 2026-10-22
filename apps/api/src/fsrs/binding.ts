// Loads the fsrs-rs optimizer. The native build needs CPU features (AVX) that some VMs hide, and
// there loading it kills the process with SIGILL, which no try/catch can stop. So it is first
// loaded in a child process; if that dies, the WASI build at FSRS_WASI_PATH (installed in the
// Docker image) is used instead. Loaded on first use, so the API starts either way.

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { Logger } from '@nestjs/common';

type Binding = typeof import('@open-spaced-repetition/binding');

const logger = new Logger('FsrsBinding');
let loading: Promise<Binding> | undefined;

async function nativeWorks(): Promise<boolean> {
  const entry = createRequire(import.meta.url).resolve('@open-spaced-repetition/binding');
  try {
    await promisify(execFile)(process.execPath, ['-e', `require(${JSON.stringify(entry)})`]);
    return true;
  } catch {
    return false;
  }
}

async function load(): Promise<Binding> {
  if (!(await nativeWorks())) {
    const wasi = process.env.FSRS_WASI_PATH;
    if (!wasi)
      throw new Error('The native FSRS optimizer cannot run on this CPU (no FSRS_WASI_PATH)');
    logger.warn('The native FSRS optimizer cannot run on this CPU; using the WASI build');
    // The binding's loader takes this in place of its native library.
    process.env.NAPI_RS_NATIVE_LIBRARY_PATH = wasi;
  }
  return import('@open-spaced-repetition/binding');
}

export function fsrsBinding(): Promise<Binding> {
  loading ??= load().catch((e: unknown) => {
    loading = undefined;
    throw e;
  });
  return loading;
}
