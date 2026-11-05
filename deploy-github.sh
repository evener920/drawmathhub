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

if git remote get-url origin >/dev/null 2>&1; then
  echo "▶ 推送到已有 remote（含 293 MB 视频，首次可能数分钟）"
  git push -u origin main
else
  echo "▶ 创建仓库并推送（含 293 MB 视频，首次可能数分钟）"
  # 不用 --push：大仓库交给下面的显式 push，失败时可直接重跑本脚本续推
  gh repo create "$REPO" --"$VIS" --source=. --remote=origin
  git push -u origin main
fi

cat <<'EOF'

✓ 代码已推送。接下来开启 Pages（二选一）：

【推荐】GitHub Actions（已自带 .github/workflows/pages.yml）
  仓库 → Settings → Pages → Build and deployment → Source 选 "GitHub Actions"
  之后每次 push main 自动部署。

【备用】Deploy from a branch
  仓库 → Settings → Pages → Source 选 "Deploy from a branch"
  Branch: main  /  目录: /dist   → Save

站点地址（项目站，相对路径已适配子目录）：
  https://evener920.github.io/<仓库名>/

⚠ 内容含原作者 Sogrey 的 60 个讲解视频，公开仓库 / 公开上线前请先取得授权。
EOF
