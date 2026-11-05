// 把零构建 ESM 项目打包成单文件自包含 HTML（所有 vendor + 题库内联，去掉外部 fetch）
// 用法：node build-standalone.cjs  ->  生成 standalone.html
const fs = require('fs')
const path = require('path')
const base = __dirname

const read = (p) => fs.readFileSync(path.join(base, p), 'utf8')

const vendorVue = read('vendor/vue.global.prod.js')
const vendorRouter = read('vendor/vue-router.global.js')
const vendorKonva = read('vendor/konva.min.js')
const styles = read('src/styles.css')
let data = read('src/data/problems.json')
// 题目文字里若含 </script 会破坏内联脚本，转义为 <\/script（JSON 中 \/ 等价于 /，值不变）
data = data.replace(/<\/script/gi, '<\\/script')

// 顺序很重要：被依赖的模块必须先声明，否则拼接成单一普通脚本后会出现
// "Cannot access 'Xxx' before initialization"（TDZ）错误。
const modules = [
  { file: 'src/store.js', name: 'store', special: 'store' },
  // 画图草稿区组件（叶子，被 problem 引用）—— 必须排在 views 之前
  { file: 'src/components/FreeBoard.js', name: 'FreeBoard' },
  // 根组件与视图（problem 引用 FreeBoard，故在其后）
  { file: 'src/App.js', name: 'App' },
  { file: 'src/views/home.js', name: 'Home' },
  { file: 'src/views/login.js', name: 'Login' },
  { file: 'src/views/problem.js', name: 'Problem' },
  // 入口（引用 App 与全部 views）
  { file: 'src/main.js', name: 'main', special: 'main' },
]

const stripImports = (src) => src.replace(/^[ \t]*import\b[^\n]*$/gm, '')

function transform(src, m) {
  src = stripImports(src)
  if (m.special === 'store') {
    src = src.replace(/export\s+const\s+store/, 'const store')
    src = src.replace(/export\s+default\s+store\s*;?/, '')
    return src
  }
  if (m.special === 'main') {
    // 普通 script 不支持顶层 await：改为 Promise 链，且必须等路由初始导航完成
    src = src.replace(
      /await store\.load\(\)\s*;?\s*await router\.isReady\(\)\s*;?\s*app\.mount\('#app'\)\s*;?/,
      "Promise.resolve().then(() => store.load()).then(() => router.isReady()).then(() => app.mount('#app'))"
    )
    return src
  }
  return src.replace(/export\s+default\s+/, `const ${m.name} = `)
}

let appCode = ''
for (const m of modules) {
  appCode += `\n/* ===== ${m.file} ===== */\n` + transform(read(m.file), m) + '\n'
}

// 数据以全局变量注入，store.load 优先读取 window.__DMH_DATA__，避免 file:// 下 fetch 失败
const head = `  window.__DMH_DATA__ = ${data};
  const PROBLEMS_DATA = window.__DMH_DATA__;
  const { createApp, reactive, ref, computed, watch, onMounted, onBeforeUnmount } = Vue;
  const { createRouter, createWebHashHistory, useRoute, useRouter } = VueRouter;
`

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>画图解题法 · DrawMathHub 复刻</title>
<style>
${styles}
</style>
</head>
<body>
<div id="app"></div>
<script>${vendorVue}</script>
<script>${vendorRouter}</script>
<script>${vendorKonva}</script>
<script>
${head}${appCode}</script>
</body>
</html>
`

fs.writeFileSync(path.join(base, 'standalone.html'), html, 'utf8')
fs.writeFileSync('/tmp/app_check.js', head + appCode, 'utf8')
console.log('standalone.html 生成，字节数:', Buffer.byteLength(html))
