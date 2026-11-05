import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import store from '../store.js'

export default {
  template: `
  <div style="max-width:420px;margin:40px auto 0">
    <section class="hero" style="padding:10px 0 18px">
      <div class="logo-big">🔑</div>
      <h1 style="font-size:24px">登录</h1>
      <div class="tagline">{{ name ? '验证密码进入「'+name+'」' : '输入昵称与密码' }}</div>
    </section>

    <div class="card">
      <div class="form-row" v-if="!name">
        <label>昵称</label>
        <input class="input" v-model="nm" placeholder="请输入昵称" @keyup.enter="submit" />
      </div>
      <div class="form-row" v-if="needPwd">
        <label>密码</label>
        <input class="input" type="password" v-model="pwd" placeholder="请输入密码" @keyup.enter="submit" />
      </div>
      <div class="err-text">{{ err }}</div>
      <button class="btn-primary btn-block" @click="submit">登录</button>
      <button class="btn-secondary btn-block" style="margin-top:10px" @click="back">返回首页</button>
    </div>
  </div>
  `,
  setup() {
    const route = useRoute()
    const name = ref('')
    const nm = ref('')
    const pwd = ref('')
    const err = ref('')
    const needPwd = computed(() => {
      const n = name.value || nm.value
      const found = store.findNick(n)
      return !!(found && found.password)
    })

    onMounted(() => {
      store.load()
      const q = route.query.name
      if (q) name.value = q
    })

    function submit() {
      err.value = ''
      const r = store.login(name.value || nm.value, pwd.value)
      if (!r.ok) {
        err.value = r.msg
        return
      }
      location.hash = '#/'
    }
    function back() {
      location.hash = '#/'
    }
    return { store, name, nm, pwd, err, needPwd, submit, back }
  },
}
