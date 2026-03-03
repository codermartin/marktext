<template>
  <div
    v-show="showTerminal"
    class="terminal-panel"
    :style="{ height: terminalHeight + 'px' }"
  >
    <div class="terminal-resize-handle" @mousedown="startResize"></div>
    <div class="terminal-header">
      <span class="terminal-title">Terminal</span>
      <div class="terminal-controls">
        <button class="terminal-btn" title="Clear" @click="clearTerminal">Clear</button>
        <button class="terminal-btn terminal-btn-close" title="Close terminal" @click="closeTerminal">✕</button>
      </div>
    </div>
    <div ref="xtermContainer" class="xterm-container"></div>
  </div>
</template>

<script>
import path from 'path'
import { ipcRenderer } from 'electron'
import { mapState } from 'vuex'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

export default {
  name: 'TerminalPanel',
  data () {
    return {
      term: null,
      fitAddon: null,
      resizeObserver: null
    }
  },
  computed: {
    ...mapState({
      showTerminal: state => state.layout.showTerminal,
      terminalHeight: state => state.layout.terminalHeight,
      currentPathname: state => state.editor.currentFile.pathname,
      projectTree: state => state.project.projectTree
    }),
    cwd () {
      if (this.projectTree && this.projectTree.pathname) {
        return this.projectTree.pathname
      }
      if (this.currentPathname) {
        return path.dirname(this.currentPathname)
      }
      return null
    },
    windowId () {
      return global.marktext.env.windowId
    }
  },
  watch: {
    showTerminal (val) {
      if (val) {
        this.$nextTick(() => this.initTerminal())
      } else {
        this.destroyTerminal()
      }
    },
    terminalHeight () {
      this.$nextTick(() => {
        if (this.fitAddon) this.fitAddon.fit()
      })
    }
  },
  mounted () {
    if (this.showTerminal) {
      this.$nextTick(() => this.initTerminal())
    }

    ipcRenderer.on('mt::terminal-data', (event, data) => {
      if (this.term) this.term.write(data)
    })

    ipcRenderer.on('mt::terminal-exit', () => {
      if (this.term) this.term.writeln('\r\n\x1b[90m[Shell exited]\x1b[0m')
    })
  },
  beforeDestroy () {
    ipcRenderer.removeAllListeners('mt::terminal-data')
    ipcRenderer.removeAllListeners('mt::terminal-exit')
    this.destroyTerminal()
  },
  methods: {
    initTerminal () {
      const container = this.$refs.xtermContainer
      if (!container) return

      this.term = new Terminal({
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selectionBackground: '#264f78',
          black: '#1e1e1e',
          red: '#f97583',
          green: '#6a9955',
          yellow: '#d7ba7d',
          blue: '#4a9eff',
          magenta: '#c586c0',
          cyan: '#4ec9b0',
          white: '#d4d4d4',
          brightBlack: '#808080',
          brightRed: '#f97583',
          brightGreen: '#6a9955',
          brightYellow: '#d7ba7d',
          brightBlue: '#4a9eff',
          brightMagenta: '#c586c0',
          brightCyan: '#4ec9b0',
          brightWhite: '#ffffff'
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        scrollback: 5000,
        allowTransparency: false
      })

      this.fitAddon = new FitAddon()
      this.term.loadAddon(this.fitAddon)
      this.term.open(container)
      this.fitAddon.fit()
      this.term.focus()

      // Send keystrokes to main process PTY
      this.term.onData(data => {
        ipcRenderer.send('mt::terminal-input', this.windowId, data)
      })

      // Notify main of size changes
      this.term.onResize(({ cols, rows }) => {
        ipcRenderer.send('mt::terminal-resize', this.windowId, { cols, rows })
      })

      // Watch container size changes (panel resize)
      this.resizeObserver = new ResizeObserver(() => {
        if (this.fitAddon) this.fitAddon.fit()
      })
      this.resizeObserver.observe(container)

      // Create PTY in main process (only once per session)
      this.createPty()
    },
    createPty () {
      const { cols, rows } = this.term
      ipcRenderer.send('mt::terminal-create', this.windowId, {
        cwd: this.cwd,
        cols,
        rows
      })
    },
    destroyTerminal () {
      ipcRenderer.send('mt::terminal-kill', this.windowId)
      if (this.resizeObserver) {
        this.resizeObserver.disconnect()
        this.resizeObserver = null
      }
      if (this.term) {
        this.term.dispose()
        this.term = null
        this.fitAddon = null
      }
    },
    clearTerminal () {
      if (this.term) this.term.clear()
    },
    closeTerminal () {
      this.$store.commit('TOGGLE_LAYOUT_ENTRY', 'showTerminal')
    },
    startResize (e) {
      const startY = e.clientY
      const startHeight = this.terminalHeight

      const onMouseMove = (moveEvent) => {
        const delta = startY - moveEvent.clientY
        const newHeight = Math.max(120, startHeight + delta)
        this.$store.dispatch('CHANGE_TERMINAL_HEIGHT', newHeight)
      }
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
  }
}
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: #1e1e1e;
  border-top: 1px solid #3c3c3c;
  overflow: hidden;
}

.terminal-resize-handle {
  height: 4px;
  cursor: ns-resize;
  background: transparent;
  flex-shrink: 0;
}

.terminal-resize-handle:hover {
  background: #4a9eff;
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
  height: 28px;
}

.terminal-title {
  font-size: 11px;
  font-weight: 600;
  color: #cccccc;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.terminal-controls {
  display: flex;
  gap: 4px;
}

.terminal-btn {
  background: transparent;
  border: 1px solid transparent;
  color: #cccccc;
  cursor: pointer;
  padding: 1px 7px;
  font-size: 11px;
  border-radius: 3px;
  opacity: 0.7;
}

.terminal-btn:hover {
  opacity: 1;
  border-color: #555;
}

.terminal-btn-close {
  font-size: 12px;
}

.xterm-container {
  flex: 1;
  overflow: hidden;
  padding: 4px 6px;
}
</style>

<style>
/* xterm.js global overrides — not scoped */
.xterm-container .xterm {
  height: 100%;
}
.xterm-container .xterm-viewport {
  overflow-y: auto !important;
}
</style>
