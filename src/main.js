import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import store from './store.js'
import App from './App.js'
import Home from './views/home.js'
import Login from './views/login.js'
import Problem from './views/problem.js'

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/problem/:id', component: Problem },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
app.use(router)

// 先加载题库数据 + 等路由完成初始导航，确保直接访问 #/problem/:id 时参数已就绪
await store.load()
await router.isReady()
app.mount('#app')
