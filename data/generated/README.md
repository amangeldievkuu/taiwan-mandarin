# Generated and written data

- `glosses-ai.jsonl`: English glosses for study-path words that CC-CEDICT lacks
  (`{ id, en }`). Written with Claude, one line per word, reviewed by hand. The content build
  marks them `glossSource: "ai"`.
- `examples-ai.jsonl`: example sentences for words Tatoeba doesn't cover
  (`{ id, zh, en, pinyin? }`). Written with Claude in Taiwan usage, using words at or below the
  word's level. `pinyin` is given only when a sentence uses a less common reading (得 děi, 還 huán).
  Otherwise the build derives it. Every sentence passes the Taiwan-standard guard.
- `reading-diffs.txt`: TOCFL readings replaced by NAER readings. Review when the lists update.
- `no-gloss.tsv`, `unreadable.txt`: what still needs attention after a build.
