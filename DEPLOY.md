# 部署说明（DrawMathHub 复刻）

## 交付物

| 路径 | 用途 |
| --- | --- |
| `dist/` | **完整上线用**：含 60 个视频，可直接整体上传到静态托管 |
| `standalone.html` | 本地双击离线预览（`file://` 可用，需与 `videos/` 同级） |
| `src/` + `vendor/` + `index.html` | 源码版（ESM，需 HTTP 服务；用于二次开发） |

`dist/` 结构：

```
dist/
├── index.html          # 单文件：HTML + CSS + Vue/VueRouter/Konva + 60 题数据全部内联（790 KB）
├── _headers            # CORS / nosniff，CF Pages 生效
├── .nojekyll           # GitHub Pages 生效
└── videos/
    └── {题目id}/
        └── {mainProblem.id}/
            └── full.mp4   # 60 个原站真实讲解视频，共 292 MB
```

`index.html` 完全自包含，**不依赖任何 CDN、不发起 fetch**，因此部署时只需保证 `videos/` 与 `index.html` 同级即可。路由用 hash（`#/problem/<id>`），**不需要任何 rewrite / SPA fallback 规则**。

## 线上现状（2026-11-05 实测）

| 地址 | 状态 |
| --- | --- |
| `https://evener920.github.io/drawmathhub/` | ✅ 已上线，GitHub Pages + Actions，轻量版（视频热链原站） |
| `https://drawmathhub.pages.dev/` | ✅ 已上线，Cloudflare Pages，轻量版（视频热链原站） |
| `https://math.201573.xyz/` | ⏳ 域名已绑到 CF Pages 项目，状态 `pending`：**缺一条 CNAME，需手工加**（见下） |

两个已上线地址都用 Chrome 无头真实渲染验证：题目页 9 张卡片正常、「讲解视频」卡片排第 4 位、`<video src>` 正确指向原站真实视频、无错误提示。

## 平台可行性（2026-11-05 核实官方文档）

| 限制项 | 本站实测 | GitHub Pages | Cloudflare Pages |
| --- | --- | --- | --- |
| 总体积 / 文件数 | 293 MB / 61 个 | 发布站点 ≤ 1 GB ✅ | 无总量硬限 ✅ |
| 最大单文件 | 6.32 MB | Git 单文件 ≤ 100 MB ✅ | ≤ 25 MiB ✅ |
| 文件数上限 | 61 | — | Wrangler ≤ 20,000 ✅ |
| 带宽 | 视频站较吃流量 | **100 GB/月软限** ⚠️ | 免费不限流量 ✅ |
| Range / 拖进度条 | 依赖 | ✅ | ✅（见下方 Safari 坑） |
| 子路径部署 | 全相对路径 + hash 路由 | ✅ 项目站 `/drawmathhub/` | ✅ |

理论结论：GitHub 和 Cloudflare 的体积限制都能满足。**但实测最大的障碍不是限制，是上传链路**：本机向 CF 一次性上传 293 MB 会失败（见「已踩坑」）。

### 当前环境状态（已实测）

| 工具 | 状态 |
| --- | --- |
| `gh`（GitHub CLI） | ✅ 已登录 `evener920`，具备 `repo` / `workflow` 权限 |
| `wrangler` 4.136.3 | ✅ 已 OAuth 登录（`xiaoluo920@gmail.com`，2026-11-05 22:31）。scope 含 `pages:write` / `zone:read` / `ssl_certs:write`，**不含 DNS 写权限** |

## 路线 A：Cloudflare Pages

```bash
/opt/homebrew/bin/wrangler login
```

```bash
./deploy-cloudflare.sh drawmathhub main
```

> 两条命令**逐条单独执行**。⚠️ 不要把行内 `#` 注释一起复制进终端 —— wrangler 会把中文注释当成未知参数，报 `Unknown arguments` 并只打印帮助、实际并未登录。

脚本已内置：登录检查、绝对路径 wrangler、`--commit-dirty=true`，并**默认绕开本机代理**（见「已踩坑」）。本机 `npx wrangler` 联网解析会挂死，一律用 `/opt/homebrew/bin/wrangler`。

### 应急：只上线轻量版（1 MB，实测 17.6 秒成功）

不需要视频自托管时，用这个先让站点可用；页面代码自带「本地缺失 → 回退原站」，视频照样能播。

```bash
cd /tmp && rm -rf dmh-lite && mkdir dmh-lite
cp /path/to/drawmathhub/dist/{index.html,_headers,.nojekyll} dmh-lite/
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
  /opt/homebrew/bin/wrangler pages deploy /tmp/dmh-lite --project-name drawmathhub --branch main
```

> **Safari / iOS 视频黑屏的已知坑**：Cloudflare 处理 MP4 的 Range 请求时可能带 weak ETag，Safari 会拒绝缓存响应。若出现，在 CF 控制台按序加两条 Cache Rules（匹配 `URI Full Wildcard *.mp4`）：① Eligible for cache + 打开 **Respect Strong ETags**；② **Bypass cache**，且 ② 排在 ① 之后。`dist/_headers` 只加了 CORS 与 nosniff，**故意不设长 `Cache-Control: immutable`**。

## 路线 B：GitHub Pages（已实际部署 ✅）

线上地址 **https://evener920.github.io/drawmathhub/** ｜ 仓库 `evener920/drawmathhub`（public / `main`）

```bash
./deploy-github.sh drawmathhub public
printf '%s' '{"build_type":"workflow"}' | gh api -X POST repos/evener920/drawmathhub/pages --input -
gh workflow run pages.yml --repo evener920/drawmathhub
```

> ⚠️ **实测坑**：Pages 的「Deploy from a branch」发布目录**只允许 `/` 或 `/docs`**，填 `/dist` 会被 API 拒绝（422）。本站**必须走 GitHub Actions**——`.github/workflows/pages.yml` 里 `path: dist` 可指定任意目录。

**GitHub 版是轻量版**：`.gitignore` 排除 `dist/videos/`。实测把 293 MB 视频塞进 Git 会让 push 拖到十几分钟并被取消，所以只推 **2.58 MB / 27 个文件**（秒级完成）。`dist/.nojekyll` 已放置；站内资源全是相对路径 + hash 路由，子路径直接工作。

## 路线 C：GitHub 存源码 + Cloudflare Pages 自动部署

在 CF 控制台 **Workers & Pages → Create → Pages → Connect to Git**，选仓库、Build command 留空、Build output directory 填 `dist`，之后 push 自动部署。

> ⚠️ Cloudflare 官方说明：**用 Git 集成创建的项目不能切回 Direct Upload**。

## 上线自定义域 `math.201573.xyz`

前提实测：`201573.xyz` 的 NS 是 `rick.ns.cloudflare.com` / `ivy.ns.cloudflare.com`，域名已在 CF 托管；`math.201573.xyz` 原为 NXDOMAIN，未被占用。

当前已通过 API 把域名加进 Pages 项目：

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/drawmathhub/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"math.201573.xyz"}'
```

**但实测：通过 API 添加不会自动写 DNS**，域名对象返回 `status: pending` + `verification_data.error_message: "CNAME record not set"`。而 `wrangler login` 的 OAuth scope 里**没有 DNS 写权限**，用该 token 调 DNS API 会返回 `10000 Authentication error`。

### 需要手工做的一步（约 30 秒）

CF 控制台 → `201573.xyz` → **DNS → Records → Add record**：

| 字段 | 值 |
| --- | --- |
| Type | `CNAME` |
| Name | `math` |
| Target | `drawmathhub.pages.dev` |
| Proxy status | **Proxied（橙云）** |
| TTL | Auto |

保存后 Pages 会自动把域名从 `pending` 转为 `active` 并签发证书（1–2 分钟）。或者给我一个带 **Zone → DNS → Edit** 权限的 `CLOUDFLARE_API_TOKEN`，我可以把这条记录也写掉。

> 也可以在 CF 控制台 **Pages → drawmathhub → Custom domains** 里删掉这条 pending、重新点一次 Add（UI 路径会自动写 DNS），但直接加 CNAME 更省事。

### 备选：GitHub Pages 绑定该域名

仓库 **Settings → Pages → Custom domain** 填 `math.201573.xyz`，再到 CF DNS 加：

```
类型 CNAME  名称 math  目标 evener920.github.io   代理状态 DNS only（灰云）
```

`math` 是子域，CNAME 指向 `用户名.github.io`（**不要带仓库名**）；只有 apex 域才需要那 4 条 A 记录。灰云会失去 CF CDN，叠加 100 GB/月带宽软限，视频站不推荐。

## 已踩坑（实测，别再重复）

| 坑 | 现象 | 结论 / 绕法 |
| --- | --- | --- |
| 本机代理 + 大包上传 | `POST /pages/assets/upload` 反复 `UND_ERR_HEADERS_TIMEOUT`，跑 11 分钟后 `Failed to upload files. Error: {}` | 代理 `127.0.0.1:53318` 扛不住 293 MB multipart。脚本已默认 `unset` 代理；`CF_USE_PROXY=1` 可强制保留 |
| 直连也失败 | 绕开代理后同样 `Failed to upload files`，约 10 分钟 | 说明瓶颈是**单次 293 MB 上传链路本身**（服务端响应头超时），不是代理一处。小包 1 MB / 17.6 秒即成功 |
| Git 推 293 MB | push 十几分钟未完成、被取消 | 视频不进 Git，改成轻量版 + 运行时回退 |
| Pages 分支发布 `/dist` | API 422 | 必须走 GitHub Actions |
| API 添加自定义域 | `CNAME record not set` | 手工加 CNAME，或用 UI 添加 |
| `wrangler login` 带行内中文注释 | `Unknown arguments: #, 约, 1, ...` | 命令逐条单独执行，不带 `#` 注释 |

**结论**：当前线上是「轻量版 + 视频回退原站」，能播、能用、零维护。若要把 60 个 mp4 也自托管，走下面的 R2 方案，别再重试一次性大包上传。

## 进阶：视频放 R2（完整自托管的正确解法）

Pages 只保留 790 KB 的 `index.html`，60 个视频放 R2 公共桶并绑定 `videos.201573.xyz`，把 `videoSrc` 前缀改成该域名。好处：R2 免费 10 GB 存储 + 免出口流量费、**S3 分块多线程上传不会触发 Pages 大包超时**、以后更新站点不必重传 293 MB。需要：R2 S3 密钥对（`boto3` 分片上传）+ 桶开公开访问 + 改 `src/views/problem.js` 并重建 `standalone.html` / `dist/index.html`。

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

> 主流静态托管默认支持 HTTP Range。`python -m http.server` 不支持，仅适合快速预览。

## 视频来源与回退

- 原站真实约定：`videos/{题目id}/{mainProblem.id}/full.mp4`；本地 60 个文件已逐一按原站 `Content-Length` 校验（0 截断）。
- 代码保留兜底：本地文件缺失 → 自动回退 `https://sogrey.top/DrawMathHub/videos/...`（原站开放 CORS）。**当前两个线上版本走的就是这条回退**，画面一致，但依赖原站可用。
- 本地 `dist/` 仍保留完整 60 个视频（292 MB），随时可供 R2 / 自托管 Nginx 使用。

## 版权与合规（公开上线前必读）

题目与讲解视频版权归原作者 Sogrey（https://sogrey.top/DrawMathHub/）。本复刻保留完整署名，仅作个人学习 / 研究使用。

当前**线上两个版本都不托管任何 mp4**（只热链原站公开视频），风险较低。若以后把 60 个 mp4 随站公开发布（CF 完整版 / R2 版），属于**再分发**，正式对外前请先取得原作者授权，或仅用于内网 / 个人用途。

GitHub Pages 官方条款对「复刻现有网站作为学习练习」有豁免条件，若走公开 Pages 需同时满足：① 代码由自己编写；② 不收集用户数据；③ **页面显著位置标注免责声明，说明本站与原站无关、仅供教育用途**。当前页面只有数据里的署名，**尚未加这条显著声明**——公开部署请先补上（可加在页脚）。

## 常见部署注意事项

- 完整 `dist/`：61 个文件、293.4 MB，最大单文件 6.32 MB。
- **CF Pages 完整版**：必须连 `videos/` 一起上传，否则只剩热链兜底；`_headers`、` .nojekyll` 也一起带。但见「已踩坑」，一次性 293 MB 在本机链路会失败，建议改 R2。
- **GitHub Actions 部署**：`.gitignore` 已排除 `dist/videos/`，仓库约 2.58 MB，这是刻意的轻量策略，不是漏文件。
- 站点为纯静态，无后端、无数据库；昵称与练习记录存在浏览器 `localStorage`，换域名/换浏览器不共享。
- 部署后自检：打开任意讲次 → 「讲解视频」卡片应显示 `0:00 / 2:06` 之类时长 → 拖动进度条能跳（验证 Range 生效）。
