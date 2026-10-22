#!/bin/sh
# Restores a dump made by the backup service into the deployment's database, replacing what is in
# it. The API is stopped while it runs, so no learner writes land halfway, and started again after.
#
#   deploy/restore.sh backups/taiwan_mandarin-20261022-040000.dump
set -eu

dump="${1:?Usage: deploy/restore.sh backups/<name>.dump}"
[ -f "$dump" ] || { echo "No such file: $dump" >&2; exit 1; }
dump="$(cd "$(dirname "$dump")" && pwd)/$(basename "$dump")" # still valid after the cd below

cd "$(dirname "$0")/.."
# The same names docker compose uses: the environment, then .env, then docker-compose.yml's defaults.
env_file() { if [ -f .env ]; then sed -n "s/^$1=//p" .env | tail -n 1; fi; }
user="${POSTGRES_USER:-$(env_file POSTGRES_USER)}"
user="${user:-taiwan}"
database="${POSTGRES_DB:-$(env_file POSTGRES_DB)}"
database="${database:-taiwan_mandarin}"

printf 'Replace everything in database "%s" with %s? [y/N] ' "$database" "$dump"
read -r answer
[ "$answer" = y ] || [ "$answer" = Y ] || { echo "Nothing changed."; exit 1; }

api="$(docker compose --profile app ps -q api)"
[ -n "$api" ] && docker compose --profile app stop api
# --clean --if-exists: drop each object before recreating it; one transaction, so a failure
# leaves the database as it was.
docker compose exec -T db pg_restore --clean --if-exists --no-owner --single-transaction \
  -U "$user" -d "$database" < "$dump"
[ -n "$api" ] && docker compose --profile app start api
echo "Restored $dump."
