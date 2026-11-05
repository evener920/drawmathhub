import { computed } from 'vue'
import store from './store.js'

export default {
  template: `
  <div class="app">
    <header class="nav">
      <div class="brand"><span class="logo">📐</span> 画图解题法<span class="sub">· 让数学变得简单有趣</span></div>
      <div class="nav-spacer"></div>
      <div class="nav-user" v-if="store.isAuthed()">
        <span>👧 <span class="who">{{ store.current }}</span></span>
        <button class="btn-ghost" @click="logout">退出</button>
      </div>
      <router-link v-else to="/login" class="btn-ghost">登录</router-link>
    </header>
    <main class="container"><router-view /></main>
    <footer class="footer-note">
      内容版权归原作者 Sogrey（<a :href="meta && meta.source" target="_blank" rel="noopener" style="color:var(--text-tertiary)">来源</a>）；本复刻保留完整署名，仅作个人学习 / 研究参考。<br/>
      DrawMathHub 复刻 · 暗色暖棕主题对齐原站
    </footer>
  </div>
  `,
  setup() {
    function logout() {
      store.logout()
    }
    return { store, meta: computed(() => store.meta), logout }
  },
}
