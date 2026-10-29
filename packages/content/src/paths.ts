import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const at = (path: string) => ROOT + path;

/** Downloaded sources (gitignored). `npm run fetch -w @taiwan-mandarin/content` fills it. */
export const RAW = {
  tocfl: at('data/raw/tocfl/tocfl-8000-20240923.xlsx'),
  naer: at('data/raw/coct/tbcl-14452-202504.xlsx'),
  frequency: at('data/raw/coct/word-freq-1141208.xlsx'),
  cedict: at('data/raw/cedict/cedict.txt'),
  cvdict: at('data/raw/cvdict/CVDICT.u8'),
  tatoebaCmn: at('data/raw/tatoeba/cmn_sentences.tsv'),
  tatoebaEng: at('data/raw/tatoeba/eng_sentences.tsv'),
  tatoebaLinks: at('data/raw/tatoeba/cmn-eng_links.tsv'),
};

/** Committed generated files and curated inputs (each language's own are in languages.ts). */
export const DATA = {
  aiExamples: at('data/generated/examples-ai.jsonl'),
  aiGlosses: at('data/generated/glosses-ai.jsonl'),
  hanviet: at('data/hanviet.json'),
  readers: at('data/readers'),
};

/** App content, served by the web app and seeded into the API. */
export const OUT = {
  content: at('apps/web/public/content'),
  dict: at('apps/web/public/dict'),
};
