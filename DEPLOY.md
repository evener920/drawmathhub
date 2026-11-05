# 部署说明（DrawMathHub 复刻）

## 交付物

| 路径 | 用途 |
| --- | --- |
| `dist/` | **上线用**：可直接整体上传到任意静态托管的目录 |
| `standalone.html` | 本地双击离线预览（`file://` 可用，需与 `videos/` 同级） |
| `src/` + `vendor/` + `index.html` | 源码版（ESM，需 HTTP 服务；用于二次开发） |

`dist/` 结构：

```
dist/
├── index.html          # 单文件：HTML + CSS + Vue/VueRouter/Konva + 60 题数据全部内联
└── videos/
    └── {题目id}/
        └── {mainProblem.id}/
            └── full.mp4   # 60 个真实讲解视频，共约 292 MB
```

`index.html` 完全自包含，**不依赖任何 CDN、不发起 fetch**，因此部署时只需保证 `videos/` 与 `index.html` 同级即可。路由用 hash（`#/problem/<id>`），**不需要任何 rewrite / SPA fallback 规则**。

## 平台可行性（2026-11-05 核实）

| 限制项 | 本站实测 | GitHub Pages | Cloudflare Pages |
| --- | --- | --- | --- |
| 总体积 / 文件数 | 293 MB / 61 个 | 发布站点 ≤ 1 GB ✅ | 无总量硬限 ✅ |
| 最大单文件 | 6.32 MB | Git 单文件 ≤ 100 MB ✅ | ≤ 25 MiB ✅ |
| 文件数上限 | 61 | — | Wrangler ≤ 20,000 ✅ |
| 带宽 | 视频站较吃流量 | **100 GB/月软限** ⚠️ | 免费不限流量 ✅ |
| Range / 拖进度条 | 依赖 | ✅ | ✅（见下方 Safari 坑） |
| 子路径部署 | 全相对路径 + hash 路由 | ✅ 项目站 `/drawmathhub/` | ✅ |

**结论：GitHub 和 Cloudflare 都能行。** 推荐 **Cloudflare Pages 直传 `dist/`**（不限带宽、不撑大 Git 仓库、无需构建）；GitHub 更适合做代码仓库 + Actions 自动部署。

### 当前环境状态（已实测）

| 工具 | 状态 |
| --- | --- |
| `gh`（GitHub CLI） | ✅ 已登录 `evener920`，具备 `repo` / `workflow` 权限，可直接建仓推送 |
| `wrangler` 4.136.3 | ⚠️ 在 `/opt/homebrew/bin/wrangler`，但 **token 已过期**：`Not logged in ... auth token has expired`。需先在交互式终端跑一次 `wrangler login` |

## 路线 A：Cloudflare Pages（推荐，最简单）

```bash
# 1) 登录（只需一次，会打开浏览器；不要在沙箱 / 非交互终端跑）
/opt/homebrew/bin/wrangler login

# 2) 一键部署（脚本内置登录检查 + 绝对路径 wrangler）
./deploy-cloudflare.sh drawmathhub main
```

等价裸命令（**不要**用 `npx wrangler`，本机实测 npx 联网解析会挂死）：

```bash
/opt/homebrew/bin/wrangler pages deploy dist --project-name drawmathhub --branch main
```

完成后得到 `https://drawmathhub.pages.dev`，可在项目里绑定自己的域名（如 `drawmath.201573.xyz`）。

> **Safari / iOS 视频黑屏的已知坑**：Cloudflare 处理 MP4 的 Range 请求时可能带 weak ETag，Safari 会拒绝缓存响应。若出现，在 CF 控制台按序加两条 Cache Rules（匹配 `URI Full Wildcard *.mp4`）：① Eligible for cache + 打开 **Respect Strong ETags**；② **Bypass cache**，且 ② 排在 ① 之后。`dist/_headers` 只加了 CORS 与 nosniff，**故意不设长 `Cache-Control: immutable`**，避免放大该问题。

## 路线 B：GitHub Pages（已实际部署 ✅）

线上地址 **https://evener920.github.io/drawmathhub/** ｜ 仓库 `evener920/drawmathhub`（public / `main`）

```bash
./deploy-github.sh drawmathhub public
printf '%s' '{"build_type":"workflow"}' | gh api -X POST repos/evener920/drawmathhub/pages --input -
gh workflow run pages.yml --repo evener920/drawmathhub
```

> ⚠️ **实测坑**：Pages 的「Deploy from a branch」发布目录**只允许 `/` 或 `/docs`**，填 `/dist` 会被 API 直接拒绝（422：`/dist is not a possible value`）。所以本站**必须走 GitHub Actions**——`.github/workflows/pages.yml` 里 `path: dist` 可指定任意目录，且不受「每小时 10 次构建」限制。

**GitHub 版是轻量版**：`.gitignore` 排除了 `dist/videos/`。实测把 293 MB 视频塞进 Git 会让 push 拖到十几分钟，所以此处只推 **2.58 MB / 27 个文件**（秒级完成）。GitHub Pages 上本地视频 404 后，代码自动回退到原站 `sogrey.top` 播放（原站开放 CORS）——**画面一致，但依赖联网和原站可用**。完整自托管版走路线 A 的 CF Pages 直传（带 `videos/`，不经 Git）。

`dist/.nojekyll` 已放置；站内资源全是相对路径、路由是 hash，**子路径可直接工作，不需要 rewrite / SPA fallback**。

## 路线 C：GitHub 存源码 + Cloudflare Pages 自动部署

在 CF 控制台 **Workers & Pages → Create → Pages → Connect to Git**，选仓库、Build command 留空、Build output directory 填 `dist`，之后 push 自动部署。

> ⚠️ Cloudflare 官方说明：**用 Git 集成创建的项目不能切回 Direct Upload**。想要「既能手动直传也能自动」就保持路线 A，另用 GitHub Actions 调 `wrangler pages deploy`。

## 上线自定义域 `math.201573.xyz`

前提已实测：`201573.xyz` 的 NS 是 `rick.ns.cloudflare.com` / `ivy.ns.cloudflare.com`，**域名已在 Cloudflare 托管**，所以绑域走 CF Pages 最省事（自动写 DNS + 自动签证书）。

### 推荐：Cloudflare Pages（终局方案，域名一键）

```bash
/opt/homebrew/bin/wrangler login
```

```bash
./deploy-cloudflare.sh drawmathhub main
```

> 两条命令**逐条单独执行**：`wrangler login` 只需一次（当前 token 已过期），会打开浏览器让你授权；授权完成后再跑第二条直传 `dist/`（不经 Git）。
> ⚠️ 不要把行内 `#` 注释一起复制进终端 —— wrangler 会把中文注释当成未知参数，报 `Unknown arguments` 并只打印帮助、实际并未登录。

然后 CF 控制台：**Workers & Pages → drawmathhub → Custom domains → Add a custom domain** → 填 `math.201573.xyz` → 激活。CF 自动加 CNAME 记录并签发证书，1–2 分钟生效，**不用手工改 DNS、不用 CNAME 文件**。

脚本化等价（CI / 非交互）：

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/drawmathhub/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"math.201573.xyz"}'
```

好处：免费不限流量（视频站关键）、CF CDN、证书自动续期、以后 `git push` 或重跑脚本即可更新。

### 备选：GitHub Pages 绑定该域名

仓库 **Settings → Pages → Custom domain** 填 `math.201573.xyz`（GitHub 会在发布源根目录生成 `CNAME` 文件），再到 CF DNS 加一条记录：

```
类型 CNAME  名称 math  目标 evener920.github.io   代理状态 DNS only（灰云）
```

`math` 是子域，官方推荐用 CNAME 指向 `用户名.github.io`（**不要带仓库名**）。只有 apex 域（如 `201573.xyz` 本身）才需要 4 条 A 记录 `185.199.108.153` / `.109` / `.110` / `.111`。配好等 HTTPS 证书签发（可能要几小时）。

> ⚠️ 灰云意味着失去 CF CDN；叠加 GitHub Pages 100 GB/月带宽软限和国内访问速度，**视频站不建议走这条**。另外启用自定义域后 `evener920.github.io/drawmathhub/` 会 301 跳转，DNS 没配好前站点会打不开——所以现在 `dist/` 里**故意没有**放 `CNAME`。

### 当前阶段（已上线）

`https://evener920.github.io/drawmathhub/` —— 先用于验证线上真实渲染（视频走原站兜底）。正式域名按上面「推荐」接 CF Pages：用的是**同一份 `dist/`**，只是那次上传**带上 `videos/`**，页面代码零改动。

## 进阶：视频放 R2（长期更优）

Pages 只保留 790 KB 的 `index.html`，60 个视频放 R2 公共桶并绑定 `videos.201573.xyz`，把 `videoSrc` 前缀改成该域名。好处：R2 免费 10 GB 存储 + 免出口流量费、不必每次部署重传 293 MB、Git 仓库不膨胀。需要改 `src/views/problem.js` 并重建 `standalone.html` / `dist/index.html`。

## 自托管 Nginx（**务必开启 Range，否则视频无法拖进度条**）

```nginx
server {
    listen 80;
    root /var/www/drawmathhub;   # 指向 dist 目录
    index index.html;
    location /videos/ {
        types { video/mp4 mp4; }
        add_header Accept-Ranges bytes;
    }
}
```

> 主流静态托管默认支持 HTTP Range。`python -m http.server` 不支持，仅适合快速预览，不建议用于生产。

## 视频来源与回退

- 视频按原站真实约定存放：`videos/{题目id}/{mainProblem.id}/full.mp4`。
- 60 个视频已从原站完整下载并逐一按 `Content-Length` 校验（0 个截断）。**CF Pages 直传版带 `videos/`，完全自播、不依赖 sogrey.top**。
- 代码保留兜底：若某题本地文件缺失，自动回退播放 `https://sogrey.top/DrawMathHub/videos/...`（原站开放 CORS）。
- **GitHub Pages 版故意不上传 `videos/`**（293 MB 不进 Git），因此线上走的就是这条回退；CF 直传版不会触发回退。

## 版权与合规（公开上线前必读）

题目与讲解视频版权归原作者 Sogrey（https://sogrey.top/DrawMathHub/）。本复刻保留完整署名，仅作个人学习 / 研究使用。

当前 **GitHub Pages 版不托管任何 mp4 文件**（只热链原站公开视频），风险较低。但路线 A 的 **CF Pages 直传版会把 60 个 mp4 随站点公开发布，属于再分发**——正式对外前请先取得原作者授权，或仅用于内网 / 个人用途。

GitHub Pages 官方条款对「复刻现有网站作为学习练习」有明确豁免条件，若走公开 Pages 需同时满足：① 代码由自己编写；② 不收集用户数据；③ **页面显著位置标注免责声明，说明本站与原站无关、仅供教育用途**。当前页面只有数据里的署名，**尚未加这条显著声明**——要公开部署请先补上（可加在页脚）。此外 Pages 禁止用作商业性网盘 / 面向交易的服务。

## 常见部署注意事项

- 完整 `dist/` 实测：61 个文件、293.4 MB，最大单文件 6.32 MB；CF Pages 单文件上限 25 MiB、GitHub 单文件上限 100 MB，均满足。
- **CF Pages 直传**：必须连 `videos/` 一起上传，否则只剩热链兜底；`dist/_headers`、`dist/.nojekyll` 也一起带。
- **GitHub Actions 部署**：`.gitignore` 已排除 `dist/videos/`，仓库只有 2.58 MB，push 秒级；这是刻意的轻量策略，不是漏文件。
- `index.html` 完全自包含（无 CDN、无 fetch），但 `videos/` 是独立文件，**必须同源部署**。
- 站点为纯静态，无后端、无数据库；昵称与练习记录存在浏览器 `localStorage`，换域名/换浏览器不共享。
- 部署后自检：打开任意讲次 → 「讲解视频」卡片应显示 `0:00 / 2:06` 之类时长 → 拖动进度条能跳（验证 Range 生效）。
