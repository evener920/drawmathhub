import { ref, computed, onMounted } from 'vue'
import store from '../store.js'

export default {
  template: `
  <div>
    <!-- 未登录：欢迎 + 创建昵称 -->
    <div v-if="!store.isAuthed()">
      <section class="hero">
        <div class="logo-big">📐</div>
        <h1>欢迎来到数学乐园</h1>
        <div class="tagline">通过画图的方式，让数学变得简单有趣</div>
      </section>

      <div class="card" style="max-width:420px;margin:0 auto 18px">
        <div class="card-title"><span class="ic">✏️</span> 新建昵称</div>
        <div class="form-row">
          <label>昵称</label>
          <input class="input" v-model="name" maxlength="12" placeholder="请输入昵称（不含空格）" @keyup.enter="create" />
        </div>
        <div class="form-row">
          <label>密码（可选）</label>
          <input class="input" type="password" v-model="pwd" placeholder="设置密码保护你的学习记录" @keyup.enter="create" />
          <div class="hint-text">可留空；设置后进入需验证密码。</div>
        </div>
        <div class="err-text">{{ err }}</div>
        <button class="btn-primary btn-block" @click="create">创建并开始学习</button>
      </div>

      <div v-if="store.hasNicks()" class="card" style="max-width:560px;margin:0 auto">
        <div class="card-title"><span class="ic">👧</span> 选择昵称进入</div>
        <div class="nick-grid">
          <div class="nick-card" v-for="n in store.allNicks()" :key="n.name" @click="pick(n.name)">
            <div class="av">🙂</div>
            <div class="nm">{{ n.name }}</div>
            <div class="meta">{{ n.password ? '🔒 需密码' : '直接进入' }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty">还没有昵称，点击上方卡片创建吧</div>
    </div>

    <!-- 已登录：大厅 -->
    <div v-else>
      <div class="page-title">学习大厅</div>
      <div class="page-sub">👧 {{ store.current }}，开始今天的画图解题吧</div>

      <div class="stats">
        <div class="stat"><div class="num">{{ store.practicedCount() }}</div><div class="lbl">已练习讲次</div></div>
        <div class="stat"><div class="num">{{ store.totalAttempts() }}</div><div class="lbl">练习次数</div></div>
        <div class="stat"><div class="num">{{ store.accuracy() }}%</div><div class="lbl">正确率</div></div>
      </div>

      <div class="group" v-for="g in groups" :key="g.method">
        <div class="group-head"><span class="dot"></span>{{ g.method }} <span style="color:var(--text-tertiary);font-weight:500;font-size:13px">（{{ g.list.length }} 讲）</span></div>
        <div class="prob-grid">
          <div class="prob-card" v-for="p in g.list" :key="p.id" @click="go(p.id)">
            <span class="done" v-if="store.isPracticed(p.id)">✅</span>
            <div class="lesson">{{ p.lesson }}</div>
            <div class="ttl">{{ p.title }}</div>
            <span class="method">{{ p.method }}</span>
          </div>
        </div>
      </div>
      <div v-if="!groups.length" class="empty">暂无题目</div>
    </div>
  </div>
  `,
  setup() {
    const name = ref('')
    const pwd = ref('')
    const err = ref('')
    const groups = computed(() => store.groupsByMethod())

    function create() {
      err.value = ''
      const r = store.createNick(name.value, pwd.value)
      if (!r.ok) {
        err.value = r.msg
        return
      }
      location.hash = '#/'
    }
    function pick(n) {
      location.hash = '#/login?name=' + encodeURIComponent(n)
    }
    function go(id) {
      location.hash = '#/problem/' + id
    }
    onMounted(() => store.load())

    return { store, name, pwd, err, groups, create, pick, go }
  },
}
