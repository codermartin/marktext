# MarkText AppImage 构建指南

## 概述

本文档记录了在OpenCloudOS环境下构建MarkText AppImage的完整过程，包含所有遇到的问题及解决方案。整个构建过程历时约2小时，最终成功生成126MB的AppImage文件。

**最终产物**: `build/marktext-x86_64.AppImage` (126MB)  
**构建时间**: 约2小时  
**解决问题数量**: 6+个技术难题

## 环境要求

### 系统环境
- **操作系统**: OpenCloudOS 9.4 (或类似RHEL系统)
- **包管理器**: yum/dnf
- **用户权限**: root或sudo权限

### 软件要求
- **Node.js**: 16.20.2 (项目严格要求，不能使用22.x)
- **yarn**: 1.22.19+
- **Git**: 用于克隆项目
- **网络代理**: `http://10.0.1.1:3128` (如果网络受限)

## 环境配置

### 1. Node.js版本管理

```bash
# 安装和配置nvm (如果未安装)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装Node.js 16.20.2
export http_proxy=http://10.0.1.1:3128
export https_proxy=http://10.0.1.1:3128
nvm install 16.20.2
nvm use 16.20.2
```

### 2. yarn包管理器配置

```bash
# 在Node 16环境中安装yarn
export PATH="/root/.nvm/versions/node/v16.20.2/bin:$PATH"
npm install -g yarn@1.22.19

# 验证安装
yarn --version  # 应显示1.22.19
```

### 3. 网络代理配置

```bash
# 设置环境变量
export http_proxy=http://10.0.1.1:3128
export https_proxy=http://10.0.1.1:3128

# 验证代理连通性
curl -x http://10.0.1.1:3128 -I https://github.com
```

## 项目获取

### 克隆项目
```bash
# 创建工作目录
mkdir -p /root/openclaw/workspace
cd /root/openclaw/workspace

# 完整克隆项目(保留git历史)
git clone https://github.com/codermartin/marktext.git
cd marktext
git checkout develop  # 切换到开发分支
```

## 系统依赖安装

在依赖安装过程中会遇到原生模块编译问题，需要预先安装系统依赖：

```bash
# 安装编译工具链
yum groupinstall -y "Development Tools"

# 安装原生模块编译所需的系统库
yum install -y \
    fontconfig-devel \
    libX11-devel \
    libxkbfile-devel \
    python3 \
    make \
    gcc-c++
```

## 依赖安装与问题解决

### 第一轮安装尝试
```bash
# 设置环境
export http_proxy=http://10.0.1.1:3128
export https_proxy=http://10.0.1.1:3128
export PATH="/root/.nvm/versions/node/v16.20.2/bin:$PATH"
export npm_execpath=/root/.nvm/versions/node/v16.20.2/lib/node_modules/yarn/bin/yarn.js

# 尝试安装
yarn install
```

**遇到的问题与解决方案**：

### 问题1: fontmanager-redux编译失败
**错误信息**: 
```
error /root/openclaw/workspace/marktext/node_modules/fontmanager-redux: Command failed.
Exit code: 1
```

**解决方案**:
```bash
# 安装fontconfig开发库
yum install -y fontconfig-devel

# 重新尝试安装
yarn install
```

### 问题2: native-keymap编译失败  
**错误信息**:
```
fatal error: X11/Xlib.h: No such file or directory
```

**解决方案**:
```bash
# 安装X11开发库
yum install -y libX11-devel libxkbfile-devel

# 重新尝试安装
yarn install
```

### 问题3: vscode-ripgrep下载失败
**错误信息**:
```
Downloading ripgrep failed: TypeError [ERR_INVALID_PROTOCOL]: Protocol "https:" not supported. Expected "http:"
```

**解决方案**:
```bash
# 手动下载ripgrep二进制文件
curl -x http://10.0.1.1:3128 -L -o /tmp/ripgrep-v13.tar.gz \
  "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-2/ripgrep-v13.0.0-2-x86_64-unknown-linux-musl.tar.gz"

# 手动放置到正确位置
mkdir -p /root/openclaw/workspace/marktext/node_modules/vscode-ripgrep/bin
tar -xzf /tmp/ripgrep-v13.tar.gz -C /root/openclaw/workspace/marktext/node_modules/vscode-ripgrep/bin
chmod 755 /root/openclaw/workspace/marktext/node_modules/vscode-ripgrep/bin/rg

# 使用--ignore-scripts跳过问题脚本
yarn install --ignore-scripts
```

### 问题4: xterm依赖缺失
**在Webpack编译阶段出现**:
```
ERROR  failed to build renderer process
Module not found: Error: Can't resolve 'xterm'
```

**解决方案**:
```bash
# 添加缺失的xterm依赖
yarn add xterm@^5.1.0 xterm-addon-fit@^0.7.0 --ignore-scripts

# 重新放置ripgrep二进制文件(被覆盖)
mkdir -p /root/openclaw/workspace/marktext/node_modules/vscode-ripgrep/bin
tar -xzf /tmp/ripgrep-v13.tar.gz -C /root/openclaw/workspace/marktext/node_modules/vscode-ripgrep/bin
```

## 完整构建流程

### 1. 环境准备
```bash
# 设置所有必需的环境变量
export http_proxy=http://10.0.1.1:3128
export https_proxy=http://10.0.1.1:3128
export PATH="/root/.nvm/versions/node/v16.20.2/bin:$PATH"
export npm_execpath=/root/.nvm/versions/node/v16.20.2/lib/node_modules/yarn/bin/yarn.js

# 验证环境
node --version  # v16.20.2
yarn --version  # 1.22.19
```

### 2. 清理构建环境
```bash
yarn run build:clean
```

### 3. Webpack编译
```bash
node .electron-vue/build.js
```
**预计时间**: 3-5分钟

### 4. 原生模块重建
```bash
./node_modules/.bin/electron-rebuild -f
```
**预计时间**: 2-3分钟

### 5. AppImage打包
```bash
npx electron-builder build --linux AppImage -c.npmRebuild=false
```
**预计时间**: 5-10分钟

### 6. 验证结果
```bash
ls -lh build/marktext-x86_64.AppImage
# -rwxr-xr-x 1 root root 126M Mar 6 20:17 build/marktext-x86_64.AppImage
```

## 常见错误诊断

### Node.js版本错误
**症状**: 编译过程中出现语法错误或模块兼容性问题
**检查**: `node --version`
**解决**: 确保使用Node.js 16.20.2

### 网络连接问题  
**症状**: 依赖下载失败、超时
**检查**: `curl -x http://10.0.1.1:3128 -I https://registry.npmjs.org`
**解决**: 确认代理配置正确

### 原生模块编译失败
**症状**: `node-gyp rebuild`失败
**检查**: 系统依赖是否安装完整
**解决**: 安装相应的-devel包

### 权限问题
**症状**: 无法写入文件或执行命令
**检查**: 当前用户权限
**解决**: 使用root用户或适当的sudo权限

## 性能优化建议

1. **并行编译**: 使用`--parallel`参数加速编译
2. **缓存利用**: 保留`node_modules`避免重复下载
3. **内存配置**: 确保足够内存(推荐4GB+)
4. **磁盘空间**: 预留至少10GB空间

## 故障排除清单

构建失败时，按以下顺序检查：

1. ✅ Node.js版本是否为16.20.2
2. ✅ yarn版本是否正确安装
3. ✅ 网络代理是否配置并可用
4. ✅ 系统依赖库是否完整安装
5. ✅ 环境变量是否正确设置
6. ✅ 磁盘空间是否充足
7. ✅ 权限是否正确

## 成功标志

构建成功的标志：
- `build/marktext-x86_64.AppImage`文件生成
- 文件大小约126MB
- 文件具有执行权限(`-rwxr-xr-x`)
- 无错误输出

## 后续使用

生成的AppImage文件可以直接执行：
```bash
chmod +x build/marktext-x86_64.AppImage
./build/marktext-x86_64.AppImage
```

## 总结

本构建过程展示了在受限网络环境和特定系统配置下构建复杂Electron应用的完整流程。关键成功因素：

1. **精确的Node.js版本控制** (16.20.2)
2. **完整的系统依赖安装** (开发库)
3. **有效的网络代理配置** 
4. **原生模块编译问题的系统性解决**
5. **构建过程中的错误处理策略**

通过遵循本指南，可以在类似环境中成功复现MarkText AppImage的构建过程。

---

**文档版本**: 1.0  
**创建日期**: 2026-03-07  
**基于构建**: MarkText develop分支  
**测试环境**: OpenCloudOS 9.4