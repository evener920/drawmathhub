import { ref, onMounted, onBeforeUnmount } from 'vue'

// 画图草稿区：自由画笔 / 橡皮 / 矩形 / 圆 / 直线 / 文字 / 撤销 / 清空 / 线宽 / 颜色
// 对齐原站「画图工具」工具条；笔触用奶油色，适配暗色画布
export default {
  props: { problem: Object },
  template: `
  <div>
    <div class="board-toolbar">
      <button class="tool-btn" :class="{on: mode==='pen'}" @click="setMode('pen')">✏️ 画笔</button>
      <button class="tool-btn" :class="{on: mode==='eraser'}" @click="setMode('eraser')">🩹 橡皮</button>
      <button class="tool-btn" :class="{on: mode==='rect'}" @click="setMode('rect')">▭ 矩形</button>
      <button class="tool-btn" :class="{on: mode==='circle'}" @click="setMode('circle')">◯ 圆</button>
      <button class="tool-btn" :class="{on: mode==='line'}" @click="setMode('line')">／ 直线</button>
      <button class="tool-btn" :class="{on: mode==='text'}" @click="setText">T 文字</button>
      <span class="tool-sep"></span>
      <label class="tool-btn" style="cursor:pointer">📏 线宽
        <select v-model="width" style="background:transparent;border:none;color:inherit;font-size:13px">
          <option v-for="w in [2,3,5,8]" :key="w" :value="w">{{ w }}</option>
        </select>
      </label>
      <label class="tool-btn" style="cursor:pointer">🎨 颜色
        <input type="color" v-model="color" style="width:22px;height:18px;border:none;background:none;padding:0;vertical-align:middle" />
      </label>
      <span class="tool-sep"></span>
      <button class="tool-btn" @click="undo">↩ 撤销</button>
      <button class="tool-btn" @click="clearAll">🗑 清空</button>
      <span class="tool-hint">选工具后在画布上绘制 · 图形可拖动</span>
    </div>
    <div class="board-wrap" ref="container"></div>
  </div>
  `,
  setup(props) {
    const container = ref(null)
    const mode = ref('pen')
    const width = ref(3)
    const color = ref('#ead6b8')
    let stage = null
    let layer = null
    let drawing = false
    let current = null
    let history = []
    let resizeHandler = null

    function setMode(m) {
      mode.value = m
    }
    function setText() {
      const v = prompt('输入文字：')
      if (v) {
        const pos = stage.getPointerPosition() || { x: 80, y: 80 }
        addNode(
          new window.Konva.Text({ x: pos.x, y: pos.y, text: v, fontSize: 18, fill: color.value, draggable: true })
        )
      }
    }
    function addNode(node) {
      layer.add(node)
      history.push(node)
      layer.draw()
    }
    function clearAll() {
      layer.destroyChildren()
      history = []
      layer.draw()
    }
    function undo() {
      const n = history.pop()
      if (n) n.destroy()
      layer.draw()
    }

    function bind() {
      const get = () => stage.getPointerPosition()
      stage.on('mousedown touchstart', (e) => {
        const pos = get()
        if (!pos) return
        if (mode.value === 'eraser') {
          const t = e.target
          if (t && t !== stage && t !== layer) {
            const idx = history.indexOf(t)
            if (idx >= 0) history.splice(idx, 1)
            t.destroy()
            layer.draw()
          }
          return
        }
        if (mode.value === 'pen') {
          drawing = true
          current = new window.Konva.Line({
            points: [pos.x, pos.y],
            stroke: color.value,
            strokeWidth: width.value,
            lineCap: 'round',
            lineJoin: 'round',
            draggable: true,
          })
          addNode(current)
        } else if (mode.value === 'rect') {
          addNode(
            new window.Konva.Rect({ x: pos.x - 45, y: pos.y - 30, width: 90, height: 60, stroke: color.value, strokeWidth: width.value, draggable: true })
          )
        } else if (mode.value === 'circle') {
          addNode(
            new window.Konva.Circle({ x: pos.x, y: pos.y, radius: 42, stroke: color.value, strokeWidth: width.value, draggable: true })
          )
        } else if (mode.value === 'line') {
          addNode(
            new window.Konva.Line({ points: [pos.x - 45, pos.y, pos.x + 45, pos.y], stroke: color.value, strokeWidth: width.value, draggable: true })
          )
        }
      })
      stage.on('mousemove touchmove', () => {
        if (drawing && current) {
          const pos = get()
          const pts = current.points()
          pts.push(pos.x, pos.y)
          current.points(pts)
          layer.batchDraw()
        }
      })
      const end = () => {
        drawing = false
        current = null
      }
      stage.on('mouseup touchend', end)
      stage.on('mouseleave', end)
    }

    function onResize() {
      if (!stage || !container.value) return
      stage.width(container.value.clientWidth || 600)
      layer.draw()
    }

    onMounted(() => {
      try {
        if (!window.Konva || !container.value) return
        stage = new window.Konva.Stage({
          container: container.value,
          width: container.value.clientWidth || 600,
          height: 280,
        })
        layer = new window.Konva.Layer()
        stage.add(layer)
        bind()
        resizeHandler = onResize
        window.addEventListener('resize', resizeHandler)
      } catch (e) {
        // 无 canvas 的环境（如无头校验）下 Konva 初始化会失败，静默降级，不影响其余功能
        stage = null
      }
    })

    onBeforeUnmount(() => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      if (stage) stage.destroy()
    })

    return { container, mode, width, color, setMode, setText, undo, clearAll }
  },
}
