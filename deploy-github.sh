#!/usr/bin/env bash
# 一键创建/推送 GitHub 仓库（含 dist/），随后按提示开启 Pages
# 用法： ./deploy-github.sh [仓库名] [private|public]
# 默认 private —— 站内含原作者视频，公开前请先取得授权
set -euo pipefail
cd "$(dirname "$0")"

REPO="${1:-drawmathhub}"
VIS="${2:-private}"

command -v gh >/dev/null 2>&1 || { echo "✗ 需要 gh CLI：brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "✗ 先执行：gh auth login"; exit 1; }

[ -d .git ] || git init -b main
# dist/ 含 293 MB 视频，放大 HTTP 缓冲避免大 push 被中断
git config http.postBuffer 524288000
git add -A
git commit -m "Deploy DrawMathHub replica" 2>/dev/null || echo "(无新改动，跳过 commit)"

# 视频由 .gitignore 排除，仓库约 2.6 MB，push 秒级完成
if git remote get-url origin >/dev/null 2>&1; then
  echo "▶ 推送到已有 remote（轻量：不含 293 MB 视频）"
  git push -u origin main
else
  echo "▶ 创建仓库并推送（轻量：不含 293 MB 视频）"
  # 不用 --push：显式 push 失败时可直接重跑本脚本续推
  gh repo create "$REPO" --"$VIS" --source=. --remote=origin
  git push -u origin main
fi

OWNER="$(gh api user --jq .login)"
PAGES_API="repos/$OWNER/$REPO/pages"

# Pages 必须用 GitHub Actions 模式："Deploy from a branch" 只允许 / 或 /docs，
# 填 /dist 会被 API 以 422 拒绝（实测）。
if gh api "$PAGES_API" >/dev/null 2>&1; then
  echo "✓ Pages 已配置"
elif printf '%s' '{"build_type":"workflow"}' | gh api -X POST "$PAGES_API" --input - >/dev/null 2>&1; then
  echo "✓ Pages 已启用（GitHub Actions 模式）"
else
  echo "⚠ Pages 启用失败，请到 Settings → Pages 手动把 Source 选为 GitHub Actions"
fi

if gh workflow run pages.yml --repo "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "✓ 已触发部署"
else
  echo "⚠ 触发部署失败，push 一次 main 或到 Actions 手动运行即可"
fi

cat <<EOF

站点地址：https://$OWNER.github.io/$REPO/
之后每次 push main 自动部署。

说明：本仓库刻意不含 293 MB 视频（.gitignore 排除 dist/videos/），
     线上视频自动回退原站播放；完整自托管版请用 deploy-cloudflare.sh 直传 dist/，
     并可在 Cloudflare 一键绑定 math.201573.xyz。
EOF
