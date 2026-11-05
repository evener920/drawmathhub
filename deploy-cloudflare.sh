#!/usr/bin/env bash
# 一键部署到 Cloudflare Pages（直接上传 dist，不经过 Git）
# 用法： ./deploy-cloudflare.sh [项目名] [分支]
set -euo pipefail
cd "$(dirname "$0")"

PROJECT="${1:-drawmathhub}"
BRANCH="${2:-main}"

# 本机 npx wrangler 常因联网解析卡死，优先用 Homebrew 全局版
WRANGLER="$(command -v wrangler || true)"
[ -x /opt/homebrew/bin/wrangler ] && WRANGLER=/opt/homebrew/bin/wrangler
if [ -z "$WRANGLER" ]; then
  echo "✗ 未找到 wrangler，请先执行： npm i -g wrangler"
  exit 1
fi

if ! "$WRANGLER" whoami >/dev/null 2>&1; then
  cat <<'EOF'
✗ Cloudflare 未登录（或 token 已过期）。

  请在「交互式终端」里执行一次（会打开浏览器授权）：
      /opt/homebrew/bin/wrangler login

  或者改用 API Token（适合 CI / 非交互环境）：
      export CLOUDFLARE_API_TOKEN=xxx
      export CLOUDFLARE_ACCOUNT_ID=xxx

  然后重新运行本脚本。
EOF
  exit 1
fi

# 实测坑：本机代理（127.0.0.1 的 HTTP_PROXY）在上传 293 MB 时会触发
# UND_ERR_HEADERS_TIMEOUT，11 分钟后报 "Failed to upload files. Error: {}"。
# 直连 api.cloudflare.com 反而更快（小请求 1.7s，1MB 部署 17s），故默认绕开代理。
# 若你的网络必须走代理，用 CF_USE_PROXY=1 ./deploy-cloudflare.sh ... 保留代理。
if [ -z "${CF_USE_PROXY:-}" ]; then
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
  echo "▶ 已绕开本机代理直连（避免大文件上传超时）；如需代理请设 CF_USE_PROXY=1"
fi

echo "▶ 部署 dist/ → Cloudflare Pages：$PROJECT ($BRANCH)"
echo "  共 61 个文件 / 293 MB / 单文件最大 6.32 MB（限 25 MiB，符合）"
exec "$WRANGLER" pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
