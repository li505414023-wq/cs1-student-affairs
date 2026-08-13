#!/usr/bin/env bash
# CS1 deploy pipeline: backup → tests → build → migrate → restart → health check.
# Usage: bash scripts/deploy.sh   (run as root on the server)
# Rollback: keep the previous .next (the script prints where) and the git HEAD
# before running; on failure `git reset --hard <previous-commit>` + `npm ci` +
# `npm run build` + `systemctl restart cs1` restores the last good build.
set -euo pipefail
cd /opt/cs1

echo "==> 1/6 部署前数据库备份"
if [[ -x /usr/local/sbin/cs1-backup.sh ]]; then
  runuser -u postgres -- /usr/local/sbin/cs1-backup.sh
else
  echo "警告: 备份脚本不存在，跳过（可先安装 /usr/local/sbin/cs1-backup.sh）" >&2
fi

echo "==> 2/6 单元测试"
npm test

echo "==> 3/6 生产构建"
npm run build

echo "==> 4/6 数据库迁移"
set -a
# shellcheck disable=SC1091
source /etc/cs1.env
set +a
npm run db:migrate
node scripts/migrate-jsonb.mjs

echo "==> 5/6 重启服务"
systemctl restart cs1
sleep 4

echo "==> 6/6 部署后健康检查"
systemctl is-active cs1
if ! curl -sf http://127.0.0.1:3000/api/health | grep -q '"ok"'; then
  echo "健康检查失败，最近日志：" >&2
  journalctl -u cs1 -n 20 --no-pager >&2
  exit 1
fi
echo "deploy complete ✓"
