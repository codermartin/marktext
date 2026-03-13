import { shell } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import log from 'electron-log'
import { electronLocalshortcut, isValidElectronAccelerator } from '@hfelix/electron-localshortcut'
import { isFile2 } from 'common/filesystem'
import { isEqualAccelerator } from 'common/keybinding'
import { isLinux, isOsx } from '../config'
import { getKeyboardInfo, keyboardLayoutMonitor } from '../keyboard'
import keybindingsDarwin from './keybindingsDarwin'
import keybindingsLinux from './keybindingsLinux'
import keybindingsWindows from './keybindingsWindows'

class Keybindings {
  /**
   * @param {CommandManager} commandManager The command manager instance.
   * @param {AppEnvironment} appEnvironment The application environment instance.
   */
  constructor (commandManager, appEnvironment) {
    const { userDataPath } = appEnvironment.paths
    this.configPath = path.join(userDataPath, 'keybindings.json')
    this.commandManager = commandManager

    this.userKeybindings = new Map()
    this.keys = this.getDefaultKeybindings()
    this._terminalFocusedWindows = new Set() // Track windows with focused terminals
    this._prepareKeyMapper()

    if (appEnvironment.isDevMode) {
      for (const [id, accelerator] of this.keys) {
        if (!commandManager.has(id)) {
          console.error(`[DEBUG] Command with id="${id}" isn't available for accelerator="${accelerator}".`)
        }
      }
    }

    // Load user-defined keybindings
    this._loadLocalKeybindings()
  }

  getAccelerator (id) {
    const name = this.keys.get(id)
    if (!name) {
      return null
    }
    return name
  }

  registerAccelerator (win, accelerator, callback) {
    if (!win || !accelerator || !callback) {
      throw new Error(`addKeyHandler: invalid arguments (accelerator="${accelerator}").`)
    }

    // Register shortcuts on the BrowserWindow instead of using Chromium's native menu.
    // This makes it possible to receive key down events before Chromium/Electron and we
    // can handle reserved Chromium shortcuts. Afterwards prevent the default action of
    // the event so the native menu is not triggered.
    electronLocalshortcut.register(win, accelerator, () => {
      callback(win)
      return true // prevent default action
    })
  }

  unregisterAccelerator (win, accelerator) {
    electronLocalshortcut.unregister(win, accelerator)
  }

  registerEditorKeyHandlers (win) {
    for (const [id, accelerator] of this.keys) {
      if (accelerator && accelerator.length > 1) {
        this.registerAccelerator(win, accelerator, () => {
          this.commandManager.execute(id, win)
        })
      }
    }
  }

  openConfigInFileManager () {
    const { configPath } = this
    if (!isFile2(configPath)) {
      fs.writeFileSync(configPath, '{\n\n\n}\n', 'utf-8')
    }
    shell.openPath(configPath)
      .catch(err => console.error(err))
  }

  setTerminalFocus (win, isFocused) {
    if (isFocused) {
      this._terminalFocusedWindows.add(win)
      this._disableTerminalConflictingShortcuts(win)
    } else {
      this._terminalFocusedWindows.delete(win)
      this._enableTerminalConflictingShortcuts(win)
    }
  }

  _getTerminalConflictingCommands () {
    // Commands that conflict with common terminal shortcuts
    return [
      'edit.copy', // Ctrl+C conflicts with terminal interrupt
      'edit.paste', // Ctrl+V conflicts with terminal paste
      'edit.cut', // Ctrl+X conflicts with some terminal functions
      'edit.select-all', // Ctrl+A conflicts with terminal beginning of line
      'edit.undo', // Ctrl+Z conflicts with terminal suspend
      'view.toggle-sidebar', // Ctrl+J might conflict with terminal line feed
      'paragraph.order-list', // Ctrl+G might be used in terminal
      'paragraph.bullet-list', // Ctrl+H might be used in terminal (backspace)
      'format.inline-code', // Ctrl+Y might conflict with terminal yank
      'format.strike', // Ctrl+D might conflict with terminal EOF
      'view.toggle-toc', // Ctrl+K might conflict with terminal kill line
      'format.hyperlink', // Ctrl+L might conflict with terminal clear screen
      'window.minimize', // Ctrl+M might conflict with terminal carriage return
      'edit.replace', // Ctrl+R might conflict with terminal reverse search
      'format.strong', // Ctrl+B might conflict with terminal backward char
      'format.emphasis', // Ctrl+I might conflict with terminal tab
      'format.underline', // Ctrl+U might conflict with terminal kill line backward
      'tabs.cycle-forward', // Ctrl+Tab might be used in terminal
      'tabs.cycle-backward' // Ctrl+Shift+Tab might be used in terminal
    ]
  }

  _disableTerminalConflictingShortcuts (win) {
    const conflictingCommands = this._getTerminalConflictingCommands()
    for (const commandId of conflictingCommands) {
      const accelerator = this.keys.get(commandId)
      if (accelerator && accelerator.length > 1) {
        electronLocalshortcut.unregister(win, accelerator)
      }
    }
  }

  _enableTerminalConflictingShortcuts (win) {
    const conflictingCommands = this._getTerminalConflictingCommands()
    for (const commandId of conflictingCommands) {
      const accelerator = this.keys.get(commandId)
      if (accelerator && accelerator.length > 1) {
        this.registerAccelerator(win, accelerator, () => {
          this.commandManager.execute(commandId, win)
        })
      }
    }
  }

  cleanupWindow (win) {
    // Clean up terminal focus tracking when a window is closed
    this._terminalFocusedWindows.delete(win)
  }

  getDefaultKeybindings () {
    if (isOsx) {
      return keybindingsDarwin
    } else if (isLinux) {
      return keybindingsLinux
    }
    return keybindingsWindows
  }

  /**
   * Returns all user key bindings.
   *
   * @returns {Map<String, String>} User key bindings.
   */
  getUserKeybindings () {
    return this.userKeybindings
  }

  /**
   * Sets and saves the given user key bindings on disk.
   *
   * @param {Map<String, String>} userKeybindings New user key bindings.
   * @returns {Promise<Boolean>}
   */
  async setUserKeybindings (userKeybindings) {
    this.userKeybindings = new Map(userKeybindings)
    return this._saveUserKeybindings()
  }

  // --- private --------------------------------

  _prepareKeyMapper () {
    // Update the key mapper to prevent problems on non-US keyboards.
    const { layout, keymap } = getKeyboardInfo()
    electronLocalshortcut.setKeyboardLayout(layout, keymap)

    // Notify key mapper when the keyboard layout was changed.
    keyboardLayoutMonitor.addListener(({ layout, keymap }) => {
      if (global.MARKTEXT_DEBUG && process.env.MARKTEXT_DEBUG_KEYBOARD) {
        console.log('[DEBUG] Keyboard layout changed:\n', layout)
      }
      electronLocalshortcut.setKeyboardLayout(layout, keymap)
    })
  }

  async _saveUserKeybindings () {
    const { configPath, userKeybindings } = this
    try {
      const userKeybindingJson = JSON.stringify(Object.fromEntries(userKeybindings), null, 2)
      await fsPromises.writeFile(configPath, userKeybindingJson, 'utf8')
      return true
    } catch (_) {
      return false
    }
  }

  _loadLocalKeybindings () {
    if (global.MARKTEXT_SAFE_MODE || !isFile2(this.configPath)) {
      return
    }

    const rawUserKeybindings = this._loadUserKeybindingsFromDisk()
    if (!rawUserKeybindings) {
      log.warn('Invalid keybinding configuration: failed to load or parse file.')
      return
    }

    // keybindings.json example:
    // {
    //   "file.save": "CmdOrCtrl+S",
    //   "file.save-as": "CmdOrCtrl+Shift+S"
    // }

    const userAccelerators = new Map()
    for (const key in rawUserKeybindings) {
      if (this.keys.has(key)) {
        const value = rawUserKeybindings[key]
        if (typeof value === 'string') {
          if (value.length === 0) {
            // Unset key
            userAccelerators.set(key, '')
          } else if (isValidElectronAccelerator(value)) {
            userAccelerators.set(key, value)
          } else {
            console.error(`[WARNING] "${value}" is not a valid accelerator.`)
          }
        }
      }
    }

    // Check for duplicate user shortcuts
    for (const [keyA, valueA] of userAccelerators) {
      for (const [keyB, valueB] of userAccelerators) {
        if (valueA !== '' && keyA !== keyB && isEqualAccelerator(valueA, valueB)) {
          const err = `Invalid keybindings.json configuration: Duplicate value for "${keyA}" and "${keyB}"!`
          console.log(err)
          log.error(err)
          return
        }
      }
    }

    if (userAccelerators.size === 0) {
      return
    }

    // Deep clone shortcuts
    const accelerators = new Map(this.keys)

    // Check for duplicate shortcuts
    for (const [userKey, userValue] of userAccelerators) {
      for (const [key, value] of accelerators) {
        // This is a workaround to unset key bindings that the user used in `keybindings.json` before
        // proper settings. Keep this for now, but add the ID to the users key binding that we show the
        // right bindings in settings.
        if (isEqualAccelerator(value, userValue)) {
          // Unset default key
          accelerators.set(key, '')

          // This entry is actually unset because the user used the accelerator.
          if (userAccelerators.get(key) == null) {
            userAccelerators.set(key, '')
          }

          // A accelerator should only exist once in the default map.
          break
        }
      }
      accelerators.set(userKey, userValue)
    }

    // Update key bindings
    this.keys = accelerators

    // Save user keybindings for settings
    this.userKeybindings = userAccelerators
  }

  _loadUserKeybindingsFromDisk () {
    try {
      const obj = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
      if (typeof obj !== 'object') {
        return null
      }
      return obj
    } catch (_) {
      return null
    }
  }
}

export default Keybindings
