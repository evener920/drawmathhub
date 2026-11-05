import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import store from '../store.js'
import FreeBoard from '../components/FreeBoard.js'

function norm(s) {
  return (s || '').toString().trim().replace(/\s+/g, '').replace(/[。.．]/g, '')
}
function toNum(s) {
  const m = (s || '').toString().match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : NaN
}

export default {
  components: { FreeBoard },
  template: `
  <div v-if="!problem" class="empty">题目未找到，请检查讲次编号</div>
  <div v-else>
    <div class="back-bar">
      <button class="back-btn" @click="back">← 返回大厅</button>
      <span style="color:var(--text-tertiary);font-size:13px">{{ problem.lesson }}</span>
    </div>

    <div class="detail-head">
      <h2>{{ problem.title }}</h2>
      <span class="method-badge">📐 推荐画图法：{{ problem.method }}</span>
    </div>

    <!-- 原题 -->
    <div class="card">
      <div class="card-title"><span class="ic">📖</span> 原题</div>
      <div class="prose">{{ problem.mainProblem.originalQuestion }}</div>
    </div>

    <!-- 画图分析 -->
    <div class="card">
      <div class="card-title"><span class="ic">🔍</span> 画图分析</div>
      <div class="prose">{{ problem.mainProblem.drawingAnalysis }}</div>
    </div>

    <!-- 分步讲解 -->
    <div class="card">
      <div class="card-title"><span class="ic">🎬</span> 分步讲解 <span class="tag" style="color:var(--text-tertiary);font-weight:500">自动播放 · 每段播完自动暂停</span></div>
      <div class="steps">
        <div class="step" v-for="(s,i) in steps" :key="i" :class="{active: i===current, done: i<current}">
          <span class="idx">{{ i+1 }}.</span>{{ s }}
        </div>
      </div>
      <div class="step-progress"><div class="bar" :style="{width: progressPct}"></div></div>
      <div class="step-player">
        <button class="tool-btn" :class="{on: playing}" @click="play">{{ playing ? '⏸ 暂停' : '▶ 播放' }}</button>
        <button class="tool-btn" @click="next">⏭ 继续下一段</button>
        <button class="tool-btn" @click="restart">↻ 重播</button>
        <span class="step-status">{{ stepStatus }}</span>
      </div>
    </div>

    <!-- 讲解视频：紧跟分步讲解，一进页面即可看到（对齐原站"讲解即播放"的位置） -->
    <div class="card">
      <div class="card-title"><span class="ic">🎥</span> 讲解视频 <span class="tag" style="color:var(--text-tertiary);font-weight:500">原站真实讲解 · 随站部署</span></div>
      <!-- 播放器常驻可见：不用 v-show 隐藏，确保浏览器一定预加载并显示控件 -->
      <video :src="videoSrc" controls playsinline preload="auto" poster=""
             @loadeddata="videoState='ready'" @canplay="videoState='ready'" @error="onVideoError"
             style="width:100%;display:block;border-radius:10px;background:#111122;aspect-ratio:16/9"></video>
      <div v-if="videoState!=='ready'" class="video-status" style="margin-top:10px">
        <template v-if="videoState==='loading'">
          <span style="color:var(--text-tertiary);font-size:13px">⏳ 正在加载讲解视频…（首次加载约需几秒）</span>
        </template>
        <template v-else>
          <div style="color:var(--text-tertiary);font-size:13px;line-height:1.7">
            🎞️ 视频暂时无法加载。本视频随站点部署在
            <b>videos/{{ problem.id }}/{{ problem.mainProblem && problem.mainProblem.id }}/full.mp4</b>，
            若未随站打包会自动回退播放原站资源（需联网）。
            <a :href="videoSrc" target="_blank" style="color:var(--primary)">点此直接打开视频 →</a>
          </div>
        </template>
      </div>
    </div>

    <!-- 规范解答 -->
    <div class="card">
      <div class="card-title"><span class="ic">✅</span> 规范解答</div>
      <div class="prose" style="color:var(--success);font-weight:600">{{ problem.mainProblem.standardSolution }}</div>
    </div>

    <!-- 规律分析 -->
    <div class="card" v-if="problem.mainProblem.keyPoints">
      <div class="card-title"><span class="ic">💡</span> 规律分析</div>
      <div class="prose">{{ problem.mainProblem.keyPoints }}</div>
    </div>

    <!-- 画图草稿区 -->
    <div class="card">
      <div class="card-title"><span class="ic">✏️</span> 画图草稿区 <span class="tag" style="color:var(--text-tertiary);font-weight:500">选工具后在画布上自由绘制</span></div>
      <FreeBoard :problem="problem" />
    </div>

    <!-- 练习 -->
    <div class="card">
      <div class="card-title"><span class="ic">📝</span> 练习 <span class="tag" style="color:var(--text-tertiary);font-weight:500">提交后显示参考答案</span></div>
      <div class="ex-item" v-for="(ex,i) in problem.exercises" :key="i">
        <div class="ex-q">{{ i+1 }}. {{ ex.question }}<span class="diff" v-if="ex.difficulty">{{ ex.difficulty }}</span></div>
        <div class="ex-row">
          <input class="input ex-input" v-model="exInputs[i]" :placeholder="ex.answerKey && ex.answerKey.type==='number' ? '请输入数字' : '请输入答案'" @keyup.enter="submit(i)" />
          <button class="btn-secondary" @click="submit(i)">提交答案</button>
        </div>
        <div class="ex-feedback" v-if="exState[i]==='ok'" :class="{ok:true}">✓ 回答正确</div>
        <div class="ex-feedback" v-else-if="exState[i]==='no'" :class="{no:true}">还不对，请对照下方参考答案</div>
        <div class="ex-ans" v-if="exState[i]">参考答案：<b>{{ ex.answer }}</b></div>
      </div>
      <div v-if="!problem.exercises || !problem.exercises.length" class="empty">本题暂无练习</div>
    </div>

    <!-- 延伸题 -->
    <div class="card" v-if="problem.extensionProblems && problem.extensionProblems.length">
      <div class="card-title"><span class="ic">🔁</span> 延伸题</div>
      <div class="ext-item" v-for="(ex,i) in problem.extensionProblems" :key="i">
        <div class="q">{{ i+1 }}. {{ ex.question }} <span class="diff" v-if="ex.difficulty" style="color:var(--warning);font-size:12px">（{{ ex.difficulty }}）</span></div>
        <div class="meta">
          <button class="ext-toggle" @click="toggle('h'+i)">{{ open['h'+i] ? '收起提示' : '看提示' }}</button>
          <button class="ext-toggle" @click="toggle('a'+i)">{{ open['a'+i] ? '收起答案' : '看答案' }}</button>
        </div>
        <div class="ext-hint" v-if="open['h'+i]">💡 提示：{{ ex.hint }}</div>
        <div class="ext-ans" v-if="open['a'+i]">✅ 答案：<b>{{ ex.answer }}</b></div>
      </div>
    </div>

    <div style="height:30px"></div>
  </div>
  `,
  setup() {
    const route = useRoute()
    const problem = computed(
      () => store.problems.find((p) => String(p.id) === String(route.params.id)) || null
    )
    // 视频地址：对齐原站真实约定 videos/{题目id}/{mainProblem.id}/full.mp4
    // 本地优先（随站点部署、离线可用），本地缺失自动回退直连原站（原站公开且 CORS* 允许跨站播放）
    const videoMode = ref('local') // 'local' | 'remote'
    const videoSrc = computed(() => {
      const p = problem.value
      if (!p) return ''
      if (p.mainProblem && p.mainProblem.video) return p.mainProblem.video
      const puuid = p.id
      const euuid = p.mainProblem && p.mainProblem.id
      if (puuid && euuid) {
        const local = `videos/${puuid}/${euuid}/full.mp4`
        const remote = `https://sogrey.top/DrawMathHub/videos/${puuid}/${euuid}/full.mp4`
        return videoMode.value === 'local' ? local : remote
      }
      return ''
    })
    const videoState = ref('loading')
    function onVideoError() {
      if (videoMode.value === 'local') {
        videoMode.value = 'remote' // 本地缺失 → 回退原站
        videoState.value = 'loading'
      } else {
        videoState.value = 'missing' // 都失败 → 占位
      }
    }
    // 切换题目时重置视频状态，避免沿用上一题的加载结果
    watch(() => (problem.value && problem.value.id), () => {
      videoMode.value = 'local'
      videoState.value = 'loading'
    })

    // 分步讲解
    const steps = computed(() => {
      const raw = (problem.value && problem.value.mainProblem && problem.value.mainProblem.drawingAnalysis) || ''
      const out = []
      raw.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
        if (s.length > 70) {
          s.split(/(?<=[。！？])/).forEach((x) => x.trim() && out.push(x.trim()))
        } else out.push(s)
      })
      return out.length ? out : ['（暂无分步讲解内容）']
    })
    const current = ref(0)
    const playing = ref(false)
    const done = ref(false)
    let timer = null
    function schedule() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (current.value < steps.value.length - 1) {
          current.value++
          if (playing.value) schedule()
        } else {
          playing.value = false
          done.value = true
        }
      }, 2600)
    }
    function play() {
      if (!problem.value) return
      if (playing.value) {
        pause()
        return
      }
      if (current.value >= steps.value.length - 1) current.value = 0
      done.value = false
      playing.value = true
      schedule()
    }
    function pause() {
      playing.value = false
      clearTimeout(timer)
    }
    function next() {
      pause()
      if (current.value < steps.value.length - 1) current.value++
    }
    const progressPct = computed(() => {
      const total = steps.value.length
      if (!total) return '0%'
      return (((current.value + 1) / total) * 100).toFixed(0) + '%'
    })
    const stepStatus = computed(() => {
      if (done.value) return '本分步讲解已看完 ✓'
      if (playing.value) return '讲解播放中…'
      if (current.value > 0) return '本段已播完，可继续下一段'
      return '讲解将自动播放'
    })
    onBeforeUnmount(() => clearTimeout(timer))

    // 练习判分
    const exInputs = ref({})
    const exState = ref({})
    function submit(i) {
      const ex = problem.value.exercises[i]
      const u = norm(exInputs.value[i])
      if (!u) {
        exState.value = { ...exState.value, [i]: 'empty' }
        return
      }
      let correct = false
      if (ex.answerKey && ex.answerKey.values && ex.answerKey.values.length) {
        if (ex.answerKey.type === 'number') {
          const un = toNum(u)
          correct = ex.answerKey.values.some((v) => toNum(v) === un)
        } else {
          correct = ex.answerKey.values.some((v) => norm(v) === u)
        }
      } else {
        correct = norm(ex.answer) === u
      }
      exState.value = { ...exState.value, [i]: correct ? 'ok' : 'no' }
      if (store.isAuthed()) store.recordPractice(problem.value.id, correct)
    }

    // 延伸题展开
    const open = ref({})
    function toggle(key) {
      open.value = { ...open.value, [key]: !open.value[key] }
    }

    function back() {
      location.hash = '#/'
    }

    function restart() {
      pause()
      current.value = 0
      playing.value = false
      done.value = false
    }

    onMounted(() => {
      store.load()
      // file:// 下本地视频缺失可能不触发 error 事件，6 秒兜底回退到原站远程源
      setTimeout(() => { if (videoState.value === 'loading' && videoMode.value === 'local') onVideoError() }, 6000)
      // 进入题目后自动开始分步讲解播放
      play()
    })

    return {
      store, problem, videoSrc, videoState, onVideoError, steps, current, playing, done, play, pause, next, restart, stepStatus, progressPct,
      exInputs, exState, submit, open, toggle, back,
    }
  },
}
