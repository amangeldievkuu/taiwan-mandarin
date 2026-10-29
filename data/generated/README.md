# Generated and written data

- `glosses-ai.jsonl`: English glosses for study-path words that CC-CEDICT lacks
  (`{ id, en }`). Written with AI, one line per word, reviewed by hand. The content build
  marks them `glossSource: "ai"`.
- `examples-ai.jsonl`: example sentences for words Tatoeba doesn't cover
  (`{ id, zh, en, pinyin? }`). Written with AI in Taiwan usage, using words at or below the
  word's level. `pinyin` is given only when a sentence uses a less common reading (得 děi, 還 huán).
  Otherwise the build derives it. Every sentence passes the Taiwan-standard guard.
- `reading-diffs.txt`: TOCFL readings replaced by NAER readings. Review when the lists update.
- `no-gloss.tsv`, `unreadable.txt`: what still needs attention after a build.

## Vietnamese

Vietnamese meanings come from CVDICT (CC-CEDICT translated, downloaded at build). What it lacks
is written with OpenAI by `npm run translate -w @taiwan-mandarin/content -- --lang vi --only <mode>`.
Run it after a build, then build again:

- `examples-vi.jsonl` (`--only examples`): Vietnamese translations of example sentences
  (`{ zh, vi }`), keyed by the Chinese, so a sentence that changes is translated again.
  Translated from the Chinese with the English as a reference.
- `../hanviet.json` (`--only hanviet`): the Sino-Vietnamese (Hán-Việt) reading of every
  character in the study path and readers, `"國": "quốc"`, or per Mandarin reading where they
  differ (`"好|hao3": "hảo"`, `"好|hao4": "hiếu"`); `null` for characters with none (喔).
  `hanviet-unihan-diffs.txt` lists readings that differ from Unihan's kVietnamese, for review
  (Unihan also lists Nôm readings, so many differences are fine).
- `glosses-vi.jsonl` (`--only glosses`): Vietnamese glosses for words CVDICT lacks (`{ id, vi }`),
  like `glosses-ai.jsonl`; the build marks them `viSource: "ai"`. A gap file: never a full list.
- `no-gloss-vi.tsv`, `hanviet-missing.txt`: what still needs attention after a build.

Hand-written Vietnamese lives with the English: the curated words (`curated.ts`) and the readers
(`data/readers/*.json`, a `vi` block).

## Russian

Russian has no dictionary to start from, so everything but the curated words and the readers is
written with OpenAI by `npm run translate -w @taiwan-mandarin/content -- --lang ru --only <mode>`:

- `glosses-ru.jsonl` (`--only glosses`): the Russian meaning of every word without a curated one
  (`{ id, ru }`), translated from the Chinese with the English gloss, part of speech, measure words
  and CC-CEDICT senses as a reference; the build marks them `ruSource: "ai"`.
- `examples-ru.jsonl` (`--only examples`): Russian translations of example sentences
  (`{ zh, ru }`), like the Vietnamese ones.
- `no-gloss-ru.tsv`: words still without a Russian meaning after a build.
