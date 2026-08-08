#!/usr/bin/env bash
# CS1 一键发布：本地推送 GitHub → 服务器同步 main → 部署流水线 → 公网健康检查。
#
# 用法:
#   bash scripts/release.sh              # 要求工作区已提交
#   bash scripts/release.sh -m "提交信息"  # 有未提交改动时自动 commit
#
# 可用环境变量覆盖:
#   SERVER     SSH 主机别名（默认 cs-server）
#   APP_DIR    服务器应用目录（默认 /opt/cs1）
#   HEALTH_URL 发布后公网健康检查地址
#
# 回滚: 服务器上 `git reset --hard <旧提交>` + `bash scripts/deploy.sh`；
# 重新对齐前的完整备份见 /root/cs1-pre-realign-*.tgz。
set -euo pipefail

SERVER="${SERVER:-cs-server}"
APP_DIR="${APP_DIR:-/opt/cs1}"
REPO_URL="${REPO_URL:-https://github.com/li505414023-wq/cs1-student-affairs.git}"
HEALTH_URL="${HEALTH_URL:-https://www.505414023.top/api/health}"

cd "$(git rev-parse --show-toplevel)"

COMMIT_MSG=""
while getopts "m:" opt; do
  case "$opt" in
    m) COMMIT_MSG="$OPTARG" ;;
    *) echo "用法: bash scripts/release.sh [-m \"提交信息\"]" >&2; exit 2 ;;
  esac
done

echo "==> 1/5 本地检查与提交"
BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "当前分支是 $BRANCH，只允许从 main 发布。" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  if [[ -n "$COMMIT_MSG" ]]; then
    git add -A
    git commit -m "$COMMIT_MSG"
  else
    echo "工作区有未提交改动；先提交，或用 -m \"信息\" 自动提交：" >&2
    git status --short >&2
    exit 1
  fi
fi
LOCAL_HEAD="$(git rev-parse HEAD)"
echo "本地 HEAD: $LOCAL_HEAD"

echo "==> 2/5 推送到 GitHub（pre-push 门禁自动跑 lint/测试/构建）"
git push origin main
REMOTE_HEAD="$(git ls-remote origin main | cut -f1)"
if [[ "$REMOTE_HEAD" != "$LOCAL_HEAD" ]]; then
  echo "远端 main ($REMOTE_HEAD) 与本地 ($LOCAL_HEAD) 不一致，中止。" >&2
  exit 1
fi

echo "==> 3/5 服务器同步 ($SERVER:$APP_DIR)"
ssh -o BatchMode=yes "$SERVER" "set -e
cd '$APP_DIR'
git remote get-url origin >/dev/null 2>&1 || git remote add origin '$REPO_URL'
if [[ -n \"\$(git status --porcelain)\" ]]; then
  echo '服务器工作区不干净，请先备份后手动处理（git stash 或 tar 备份后 git reset --hard origin/main）。' >&2
  git status --short >&2
  exit 1
fi
PRE=\$(git rev-parse HEAD)
git fetch origin main
git merge --ff-only origin/main
POST=\$(git rev-parse HEAD)
echo \"服务器同步: \$PRE -> \$POST\"
if [[ \"\$PRE\" != \"\$POST\" ]] && git diff --name-only \"\$PRE\" \"\$POST\" | grep -qx 'package-lock.json'; then
  echo '依赖锁有变化，执行 npm ci'
  npm ci --no-audit --no-fund
fi"

echo "==> 4/5 服务器部署流水线（备份→测试→构建→迁移→重启→健康检查）"
ssh -o BatchMode=yes "$SERVER" "cd '$APP_DIR' && bash scripts/deploy.sh"

echo "==> 5/5 公网健康检查"
for i in $(seq 1 10); do
  if BODY="$(curl -sf -m 10 "$HEALTH_URL" 2>/dev/null)"; then
    echo "$BODY"
    echo "发布完成 ✓ $LOCAL_HEAD 已上线"
    exit 0
  fi
  sleep 3
done
echo "健康检查失败: $HEALTH_URL" >&2
exit 1
