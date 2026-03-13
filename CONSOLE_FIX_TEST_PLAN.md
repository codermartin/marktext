# MarkText Console 控制键修复测试计划

## 问题描述
MarkText 在 console/terminal 模式下，常用的控制键（ESC、Ctrl+C、Ctrl+V等）无法正常工作，因为被应用程序的全局快捷键拦截了。

## 解决方案
实现了动态快捷键管理系统：
1. 当 terminal 组件获得焦点时，自动禁用冲突的全局快捷键
2. 当 terminal 组件失去焦点时，重新启用全局快捷键
3. 确保 terminal 可以接收到原生的键盘事件

## 修改的文件

### 1. `src/renderer/components/terminal/index.vue`
- 添加了 `term.onFocus()` 和 `term.onBlur()` 事件处理
- 通过 IPC 通知主进程 terminal 的焦点状态变化

### 2. `src/main/app/index.js`
- 添加了 `mt::terminal-focus` IPC 消息处理
- 将焦点状态传递给 keybinding 系统

### 3. `src/main/keyboard/shortcutHandler.js`
- 添加了 `_terminalFocusedWindows` 集合来跟踪哪些窗口的 terminal 有焦点
- 实现了 `setTerminalFocus()` 方法来管理焦点状态
- 添加了 `_getTerminalConflictingCommands()` 来定义冲突的命令
- 实现了 `_disableTerminalConflictingShortcuts()` 和 `_enableTerminalConflictingShortcuts()` 方法

## 被修复的快捷键冲突

以下快捷键在 terminal 获得焦点时将被临时禁用：

- `Ctrl+C` (edit.copy) → 允许 terminal 处理中断信号
- `Ctrl+V` (edit.paste) → 允许 terminal 处理粘贴
- `Ctrl+X` (edit.cut) → 避免与 terminal 功能冲突
- `Ctrl+A` (edit.select-all) → 允许 terminal 行首功能
- `Ctrl+Z` (edit.undo) → 允许 terminal 挂起进程
- `Ctrl+J` (view.toggle-sidebar) → 避免与 terminal 换行冲突
- 其他可能冲突的快捷键...

## 测试步骤

### 基础功能测试
1. **启动 MarkText**
2. **打开 Terminal** (Ctrl+Shift+T)
3. **测试基础 terminal 操作**：
   ```bash
   echo "Hello World"
   ls -la
   ```

### 控制键测试
4. **测试 Ctrl+C**：
   ```bash
   ping localhost  # 启动一个持续运行的命令
   # 按 Ctrl+C 应该能中断命令
   ```

5. **测试 Ctrl+V 粘贴**：
   - 在系统其他地方复制一段文本
   - 在 terminal 中按 Ctrl+V 应该能粘贴

6. **测试 Ctrl+A**：
   - 输入一行命令但不执行
   - 按 Ctrl+A 应该将光标移动到行首

7. **测试 Ctrl+Z**：
   ```bash
   top  # 启动 top 命令
   # 按 Ctrl+Z 应该能挂起进程
   bg   # 恢复后台执行
   fg   # 恢复前台执行
   ```

### 焦点切换测试
8. **测试焦点切换**：
   - Terminal 有焦点时，Ctrl+C 应该发送到 terminal
   - 点击编辑器区域使其获得焦点
   - 此时 Ctrl+C 应该执行复制功能
   - 再次点击 terminal，Ctrl+C 又应该发送到 terminal

### 编辑器功能测试
9. **确保编辑器功能正常**：
   - 在编辑器中输入文本
   - Ctrl+C 应该复制选中的文本
   - Ctrl+V 应该粘贴文本
   - 其他快捷键应该正常工作

## 预期结果
- ✅ Terminal 获得焦点时，控制键直接发送给 terminal
- ✅ Terminal 失去焦点时，全局快捷键恢复正常
- ✅ 编辑器的正常功能不受影响
- ✅ 其他应用功能保持稳定

## 构建和测试指令
```bash
# 切换到修复分支
cd /root/openclaw/workspace/marktext-console-fix

# 安装依赖（如果需要）
npm install --force

# 开发模式运行
npm run dev

# 或者构建测试版本
npm run build:dev
npm run build:bin
```

## 注意事项
- 此修复只影响 terminal 焦点状态下的快捷键行为
- 不会影响 MarkText 的其他编辑功能
- 修复是动态的，无需重启应用程序
- 兼容现有的用户自定义快捷键配置