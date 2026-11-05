import { reactive } from 'vue'

const NICKS_KEY = 'dmh_nicks'       // [{name, password, stats:{[pid]:{attempts,correct}}}]
const CUR_KEY = 'dmh_current'       // 当前昵称
const PROGRESS_KEY = 'dmh_progress'  // 兼容旧版：{ [pid]: 'mastered'|'practicing' }

function loadJSON(key, def) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : def
  } catch (e) {
    return def
  }
}

export const store = reactive({
  nicks: loadJSON(NICKS_KEY, []),
  current: localStorage.getItem(CUR_KEY) || '',
  problems: [],
  meta: null,
  loaded: false,

  // ---------- 昵称 / 登录 ----------
  allNicks() {
    return this.nicks
  },
  hasNicks() {
    return this.nicks.length > 0
  },
  findNick(name) {
    return this.nicks.find((n) => n.name === name) || null
  },
  createNick(name, password) {
    name = (name || '').trim()
    if (!name) return { ok: false, msg: '请输入昵称' }
    if (/\s/.test(name)) return { ok: false, msg: '昵称不能包含空格' }
    if (name.length > 12) return { ok: false, msg: '昵称最多 12 个字符' }
    if (this.findNick(name)) return { ok: false, msg: '该昵称已存在，请选择其他昵称' }
    this.nicks.push({ name, password: password || '', stats: {} })
    this._persistNicks()
    this.current = name
    localStorage.setItem(CUR_KEY, name)
    return { ok: true }
  },
  login(name, password) {
    const n = this.findNick(name)
    if (!n) return { ok: false, msg: '请检查昵称或密码' }
    if (n.password && n.password !== (password || '')) {
      return { ok: false, msg: '请检查昵称或密码' }
    }
    this.current = name
    localStorage.setItem(CUR_KEY, name)
    return { ok: true }
  },
  logout() {
    this.current = ''
    localStorage.removeItem(CUR_KEY)
  },
  curNick() {
    return this.findNick(this.current)
  },
  isAuthed() {
    return !!this.findNick(this.current)
  },

  // ---------- 练习统计 ----------
  recordPractice(pid, correct) {
    const n = this.curNick()
    if (!n) return
    const s = n.stats[pid] || { attempts: 0, correct: 0 }
    s.attempts += 1
    if (correct) s.correct += 1
    n.stats[pid] = s
    this._persistNicks()
  },
  totalAttempts() {
    const n = this.curNick()
    if (!n) return 0
    return Object.values(n.stats).reduce((a, s) => a + s.attempts, 0)
  },
  totalCorrect() {
    const n = this.curNick()
    if (!n) return 0
    return Object.values(n.stats).reduce((a, s) => a + s.correct, 0)
  },
  accuracy() {
    const a = this.totalAttempts()
    return a ? Math.round((this.totalCorrect() / a) * 100) : 0
  },
  practicedCount() {
    const n = this.curNick()
    if (!n) return 0
    return Object.values(n.stats).filter((s) => s.attempts > 0).length
  },

  // 兼容旧版进度标记（用于大厅“已练”角标）
  _legacyProgress() {
    return loadJSON(PROGRESS_KEY, {})
  },
  isPracticed(pid) {
    const n = this.curNick()
    if (n && n.stats[pid] && n.stats[pid].attempts > 0) return true
    return !!this._legacyProgress()[pid]
  },

  // ---------- 方法分组（大厅） ----------
  groupsByMethod() {
    const map = new Map()
    for (const p of this.problems) {
      const m = p.method || '其他'
      if (!map.has(m)) map.set(m, [])
      map.get(m).push(p)
    }
    return [...map.entries()].map(([method, list]) => ({
      method,
      list: list.sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0)),
    }))
  },

  // ---------- 数据加载 ----------
  async load() {
    if (this.loaded) return
    const d = window.__DMH_DATA__ || (await (await fetch('./src/data/problems.json')).json())
    this.problems = d.problems
    this.meta = d.meta
    this.loaded = true
  },

  _persistNicks() {
    localStorage.setItem(NICKS_KEY, JSON.stringify(this.nicks))
  },
})

export default store
