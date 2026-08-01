#!/usr/bin/env bash
set -euo pipefail

if [[ ! -s /var/lib/pgsql/data/PG_VERSION ]]; then
  PGSETUP_INITDB_OPTIONS="--data-checksums --encoding=UTF8 --locale=C.UTF-8 --auth-local=peer --auth-host=scram-sha-256" \
    postgresql-setup --initdb
fi

systemctl enable --now postgresql
runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<'SQL'
ALTER SYSTEM SET listen_addresses = '127.0.0.1';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET max_connections = 50;
ALTER SYSTEM SET shared_buffers = '768MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET work_mem = '8MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
ALTER SYSTEM SET statement_timeout = '30s';
ALTER SYSTEM SET log_min_duration_statement = '500ms';
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
SQL
systemctl restart postgresql

if runuser -u postgres -- psql -tAc "select 1 from pg_roles where rolname='cs1_app'" | grep -q 1; then
  if [[ ! -r /etc/cs1-stage.env ]]; then
    echo "cs1_app already exists but /etc/cs1-stage.env is unavailable; refusing to rotate credentials" >&2
    exit 1
  fi
  pg_password="$(sed -n 's#^DATABASE_URL=postgresql://cs1_app:\([^@]*\)@.*#\1#p' /etc/cs1-stage.env)"
  [[ -n "$pg_password" ]]
else
  pg_password="$(openssl rand -hex 24)"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 --set=role_password="$pg_password" <<'SQL'
CREATE ROLE cs1_app LOGIN PASSWORD :'role_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SQL
fi

runuser -u postgres -- dropdb --if-exists cs1_stage
runuser -u postgres -- createdb --owner=cs1_app --encoding=UTF8 cs1_stage
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d cs1_stage <<'SQL'
REVOKE ALL ON DATABASE cs1_stage FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO cs1_app;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SQL

install -o root -g cs1 -m 640 /dev/null /etc/cs1-stage.env
printf 'DATABASE_URL=postgresql://cs1_app:%s@127.0.0.1:5432/cs1_stage\nDATABASE_POOL_SIZE=10\n' \
  "$pg_password" > /etc/cs1-stage.env
unset pg_password

systemctl is-active --quiet postgresql
[[ "$(runuser -u postgres -- psql -tAc 'show data_checksums' | xargs)" == "on" ]]
ss -lnt | grep -q '127.0.0.1:5432'
echo "PostgreSQL staging database is ready"
