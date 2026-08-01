#!/usr/bin/env bash
set -euo pipefail

if runuser -u postgres -- psql -tAc "select 1 from pg_database where datname='cs1'" | grep -q 1; then
  echo "Database cs1 already exists; refusing to replace it" >&2
  exit 1
fi
if [[ ! -r /etc/cs1-stage.env ]]; then
  echo "/etc/cs1-stage.env is required" >&2
  exit 1
fi

runuser -u postgres -- createdb --owner=cs1_app --encoding=UTF8 cs1
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d cs1 <<'SQL'
REVOKE ALL ON DATABASE cs1 FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO cs1_app;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL

install -o root -g cs1 -m 640 /dev/null /etc/cs1.env
sed 's#/cs1_stage$#/cs1#' /etc/cs1-stage.env > /etc/cs1.env
grep -q '/cs1$' /etc/cs1.env
echo "Production PostgreSQL database is ready for schema migration"
