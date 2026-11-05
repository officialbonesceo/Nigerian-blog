# Pending syndication queue

Each new article is written here as `{slug}.json` by `scripts/queue-syndication.ts`.

`scripts/run-file-syndication.ts` posts to social + IndexNow, then **deletes** the file and appends a line to `../history.jsonl`.

Deduplication is **file-based only** (pending + history). No D1 `automation_logs` checks.
