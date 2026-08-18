# Toolbooox

<div align="center">

**一个本地优先的 Chrome 插件工具箱**

`Manifest V3` · `React` · `TypeScript` · `Vite` · `IndexedDB` · `Web Crypto`

[中文](#中文) | [English](#english)

</div>

---

## 中文

Toolbooox 是一个本地优先的 Chrome 浏览器插件，目标是把高频的小工具集中到一个轻量、可扩展、隐私友好的工具箱里。

当前功能包括：

- 密码管理器
- 域名替换
- 查看 Cookie
- 文本比较
- 语言翻译
- 计算器
- 地址导航
- 待办事项
- 可配置菜单
- Options 长文本比较页
- Chrome Side Panel 侧边栏

插件不提供云同步，不上传密码、Cookie、文本或计算内容。业务数据保存在用户自己的浏览器环境中。

### 目录

- [功能说明](#功能说明)
- [数据与隐私](#数据与隐私)
- [权限说明](#权限说明)
- [技术方案](#技术方案)
- [目录结构](#目录结构)
- [本地开发](#本地开发)
- [测试覆盖](#测试覆盖)
- [安装与发布](#安装与发布)
- [开发约束](#开发约束)

### 功能说明

#### 密码管理器

密码管理器用于本地保存网站账号信息。

| 能力         | 说明                                                      |
| ------------ | --------------------------------------------------------- |
| 本地保存     | 保存显示名称、网址、账号、密码                            |
| 当前网站匹配 | 根据当前标签页 URL 自动匹配同域名或子域名账号             |
| 全量列表     | 支持查看全部账号和其他网站账号                            |
| 分页浏览     | 已保存账号按每页 10 条分页                                |
| 快捷操作     | 支持复制账号、复制密码、显示/隐藏密码、编辑、删除         |
| 导入导出     | 支持 JSON 导出备份和 JSON 导入替换本地密码库              |
| 加密落库     | 密码字段写入 IndexedDB 前使用 Web Crypto API AES-GCM 加密 |

实现位置：

- `src/shared/passwordVault/storage.ts`
- `src/shared/passwordVault/urlMatcher.ts`
- `src/shared/passwordVault/pagination.ts`
- `src/popup/main.tsx`

#### 域名替换

域名替换用于在在线环境和本地开发环境之间快速切换当前页面 URL。

| 能力     | 说明                                       |
| -------- | ------------------------------------------ |
| 规则保存 | 保存线上域名与本地域名映射                 |
| 自动填充 | 根据当前标签页自动填充线上域名             |
| 双向切换 | 命中线上域名时切本地，命中本地域名时切线上 |
| URL 保真 | 保留 pathname、query、hash                 |
| 规则管理 | 支持保存、选择、删除规则                   |

实现位置：

- `src/shared/devTools/domainSwitcher.ts`
- `src/popup/main.tsx`

#### 查看 Cookie

查看 Cookie 用于观察某个接口请求真实携带的 Cookie header。

| 能力     | 说明                                                        |
| -------- | ----------------------------------------------------------- |
| 接口配置 | 为当前网站保存一个要观察的接口 URL                          |
| 请求捕获 | 后台通过 `chrome.webRequest.onBeforeSendHeaders` 捕获请求头 |
| 精确匹配 | 捕获时按 origin + pathname 匹配，忽略 query/hash            |
| 会话暂存 | 捕获结果优先保存到 `chrome.storage.session`                 |
| 兜底读取 | 必要时使用 `chrome.cookies` 按 URL 读取 Cookie              |
| 结果展示 | 展示完整 Cookie header，并拆分成 Cookie 名和值              |

实现位置：

- `src/background/main.ts`
- `src/shared/chrome/cookies.ts`
- `src/popup/main.tsx`

#### 文本比较

文本比较用于本地对比两段文本，提供类似 Git diff 的查看和采用变更能力。

| 能力       | 说明                                    |
| ---------- | --------------------------------------- |
| 左右输入   | 左侧为原始文本，右侧为修改后文本        |
| 行级差异   | 按行标记新增、删除、未变更              |
| 字符级高亮 | 相邻增删行会继续标记行内字符差异        |
| 采用变更   | 支持对变更块选择采用左侧或右侧          |
| 长文本页   | 超过阈值时可打开 Options 全屏长文本比较 |
| 折叠相同行 | Options 页中长段未变更内容可折叠/展开   |

实现位置：

- `src/shared/textCompare/diff.ts`
- `src/shared/textCompare/storage.ts`
- `src/popup/main.tsx`
- `src/options/main.tsx`

#### 语言翻译

语言翻译使用 Chrome 内置 Translator API 在本机完成翻译。

| 能力       | 说明                                         |
| ---------- | -------------------------------------------- |
| 多语言选择 | 支持选择源语言和目标语言                     |
| 本地执行   | 通过 Chrome 内置 AI 翻译能力执行，不上传文本 |
| 可用性检测 | 当前 Chrome 不支持或语言对不可用时会提示     |
| 译文复制   | 支持一键复制翻译结果                         |

实现位置：

- `src/shared/translation/chromeTranslator.ts`
- `src/popup/main.tsx`

#### 计算器

计算器支持表达式输入、按钮输入和侧边栏持续使用。

| 能力       | 说明                                                     |
| ---------- | -------------------------------------------------------- |
| 表达式输入 | 支持直接输入表达式                                       |
| 按钮输入   | 支持数字、加减乘除、百分号、正负切换、小数点、删除、清空 |
| 键盘操作   | 回车计算，Esc 清空                                       |
| 精确计算   | 使用 BigInt 有理数模型计算，避免 JS 浮点误差             |
| 千分位     | 结果整数部分按千分位展示                                 |
| 中文读法   | 结果整数部分超过 3 位时展示中文读法                      |
| 状态恢复   | 弹窗关闭再打开后恢复表达式、结果和中文读法               |
| 最近计算   | 侧边栏展示最近 10 次计算记录，超出自动裁剪               |

计算器没有使用 `eval` 或 `Function`。表达式会被解析为 token，经 shunting-yard 流程转换并计算。内部使用 BigInt 分子/分母保存有理数，中间步骤不提前四舍五入；只有最终展示无限循环小数时才按 10 位小数格式化。

示例：

```text
0.1 + 0.2 => 0.3
1 / 6 * 6 => 1
1000000000 + 2000000000 => 3,000,000,000
180000000 => 180,000,000（一亿八千万）
```

实现位置：

- `src/shared/calculator/evaluate.ts`
- `src/shared/calculator/storage.ts`
- `src/popup/main.tsx`
- `src/sidepanel/main.tsx`

#### 地址导航

地址导航用于保存常用网站入口，点击网址即可在新页面打开。

| 能力     | 说明                                                     |
| -------- | -------------------------------------------------------- |
| 本地保存 | 保存标题、网站 URL 和备注                                |
| URL 校验 | 保存前校验网址，只接受 `http/https` 地址                 |
| 协议补全 | 输入 `example.com` 时会自动补全为 `https://example.com/` |
| 快速打开 | 点击标题、网址或打开按钮，会在新页面打开网址             |
| 删除管理 | 支持删除不再需要的地址                                   |

实现位置：

- `src/shared/addressNavigation/storage.ts`
- `src/popup/main.tsx`

#### 待办事项

待办事项用于记录轻量任务，支持弹窗与侧边栏使用。

| 能力     | 说明                             |
| -------- | -------------------------------- |
| 本地保存 | 待办数据保存在本地存储           |
| 状态管理 | 支持待办/已办结状态              |
| 编辑删除 | 支持编辑和删除单条待办           |
| 时间展示 | 展示创建时间和已进行天数         |
| 侧边栏   | 可在 Side Panel 中持续查看和操作 |
| 统计信息 | 展示待办、已办结、总计数量       |

实现位置：

- `src/shared/todos/storage.ts`
- `src/popup/main.tsx`
- `src/sidepanel/main.tsx`

#### 可配置菜单

设置页支持控制左侧功能菜单。

| 能力       | 说明                     |
| ---------- | ------------------------ |
| 显隐控制   | 可隐藏低频功能           |
| 排序控制   | 可调整功能菜单顺序       |
| 状态持久化 | 菜单配置保存在 IndexedDB |
| 版本展示   | 设置页展示当前插件版本   |

### 数据与隐私

Toolbooox 的设计原则是本地优先。

| 数据            | 存储位置                      | 说明                                       |
| --------------- | ----------------------------- | ------------------------------------------ |
| 密码库          | IndexedDB                     | 密码字段使用 AES-GCM 加密后保存            |
| 密码加密密钥    | IndexedDB                     | 用于本机解密本机保存的密码                 |
| 域名替换规则    | IndexedDB                     | 本地规则，不联网                           |
| Cookie 观察配置 | IndexedDB                     | 保存每个站点要观察的接口 URL               |
| Cookie 捕获结果 | `chrome.storage.session` 优先 | 会话级暂存，浏览器会话结束后清理           |
| 文本比较状态    | IndexedDB                     | 保存左右文本和比较状态，便于打开 Options   |
| 语言翻译        | 不持久化                      | 文本只用于当前翻译请求                     |
| 计算器状态      | IndexedDB                     | 保存表达式、结果、中文描述、最近 10 次记录 |
| 地址导航        | IndexedDB                     | 保存标题、网址和备注                       |
| 待办事项        | IndexedDB                     | 保存待办列表                               |
| 菜单设置        | IndexedDB                     | 保存显隐、排序、最后激活功能               |
| 语言设置        | IndexedDB                     | 保存插件界面语言                           |

注意：

- 插件不发起业务数据上传请求。
- 密码库导出的 JSON 文件包含可恢复账号数据，应只保存在可信位置。
- AES-GCM 本地加密用于避免密码明文直接落库；如果本地浏览器数据和本地密钥同时被完整读取，仍需要视为存在风险。

### 权限说明

`public/manifest.json` 当前声明：

| 权限         | 用途                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `storage`    | 保存密码密钥、菜单设置、域名规则、Cookie 配置、计算器状态、待办事项等 |
| `activeTab`  | 获取当前标签页 URL，用于账号匹配、域名替换、当前网站展示              |
| `cookies`    | 查看 Cookie 功能中按 URL 读取 Cookie 作为兜底                         |
| `webRequest` | 捕获指定接口请求真实携带的 Cookie header                              |
| `sidePanel`  | 打开 Chrome Side Panel                                                |
| `<all_urls>` | 支持用户配置任意网站/API 地址进行匹配和监听                           |

### 技术方案

| 分类       | 方案                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| 插件规范   | Manifest V3                                                               |
| 前端       | React + TypeScript                                                        |
| 构建       | Vite，多入口构建 popup/options/sidepanel/background                       |
| 后台脚本   | MV3 service worker                                                        |
| 本地数据库 | IndexedDB                                                                 |
| 会话状态   | `chrome.storage.session`                                                  |
| 密码加密   | Web Crypto API AES-GCM                                                    |
| 语言翻译   | Chrome built-in Translator API                                            |
| 计算器     | BigInt 有理数计算，避免 JS 浮点误差，不使用 `eval`                        |
| 文本比较   | 本地 diff 逻辑，支持行级和字符级结果                                      |
| 国际化     | Manifest 使用 `_locales`；应用内文案由 `src/shared/i18n/messages.ts` 管理 |
| 测试       | Vitest + fake-indexeddb                                                   |

### 目录结构

```text
.
├── public/
│   ├── manifest.json
│   └── _locales/
├── src/
│   ├── background/          # MV3 service worker
│   ├── options/             # Options 长文本比较页
│   ├── popup/               # 插件弹窗主应用
│   ├── sidepanel/           # Chrome Side Panel 页面
│   └── shared/
│       ├── addressNavigation/ # 地址导航存储和 URL 校验
│       ├── calculator/      # 计算器解析、精确计算、状态存储
│       ├── chrome/          # Chrome API 辅助封装
│       ├── devTools/        # 域名替换逻辑
│       ├── i18n/            # 应用内文案和语言设置
│       ├── passwordVault/   # 密码库、加密、导入导出、分页
│       ├── sidePanel/       # popup 与 side panel 通信消息
│       ├── textCompare/     # 文本比较 diff 和状态
│       ├── translation/     # Chrome 内置翻译 API 封装
│       └── todos/           # 待办事项存储
├── docs/
│   ├── INSTALL.zh-CN.md
│   └── RELEASE.zh-CN.md
├── popup.html
├── options.html
├── sidepanel.html
└── vite.config.ts
```

### 本地开发

安装依赖：

```bash
npm install
```

常用命令：

```bash
npm run dev      # 启动 Vite 开发服务
npm run build    # TypeScript 检查并构建扩展
npm run test     # 运行单元测试
npm run preview  # 预览构建产物
```

加载扩展：

1. 执行 `npm run build`。
2. 打开 `chrome://extensions`。
3. 开启开发者模式。
4. 选择 `加载已解压的扩展程序`。
5. 选择项目的 `dist/` 目录。

注意：Vite 构建产物文件名带 hash。每次重新 build 后，需要在 `chrome://extensions` 手动刷新扩展，否则 Chrome 可能仍运行旧代码。

### 测试覆盖

当前单元测试覆盖：

- 密码库 IndexedDB 加密写入、解密读取。
- 密码库 URL 校验、账号去重、导入数据校验。
- 域名替换规则保存、双向切换、URL 保真。
- Cookie 捕获 URL 匹配、Cookie header 解析。
- 文本比较行级 diff、字符级 diff、变更块应用。
- 计算器精确小数、大整数、除法链式计算、百分号、正负切换、中文读法。
- 地址导航 URL 校验、协议补全、保存和删除。
- 待办事项新增、更新、删除、完成状态。

发布前建议至少执行：

```bash
npm run test
npm run build
```

### 安装与发布

| 渠道            | 状态     | 说明                               |
| --------------- | -------- | ---------------------------------- |
| Chrome 应用商店 | 待发布   | 面向可访问 Chrome Web Store 的用户 |
| GitHub Releases | 计划支持 | 面向手动安装用户                   |

手动安装说明见：[docs/INSTALL.zh-CN.md](docs/INSTALL.zh-CN.md)。

发布流程见：[docs/RELEASE.zh-CN.md](docs/RELEASE.zh-CN.md)。

### 开发约束

- 不上传用户业务数据。
- 不使用 `eval` 或 `Function` 执行用户输入。
- 不提交真实 Cookie、token、内部域名、私钥或导出的密码库 JSON。
- 新增功能优先抽到 `src/shared/`，便于 popup、options、sidepanel 复用。
- 涉及核心逻辑时补单元测试，尤其是存储、解析、加密、计算、diff。

---

## English

Toolbooox is a local-first Chrome extension that collects everyday utilities in one compact toolbox. It is built for local use, privacy, and extensibility.

Current features:

- Password Manager
- Domain Switcher
- Cookie Viewer
- Text Compare
- Language Translation
- Calculator
- Address Navigation
- Todo Items
- Configurable menu
- Options page for long text comparison
- Chrome Side Panel support

Toolbooox does not provide cloud sync and does not upload passwords, cookies, text, calculations, or todo data.

### Features

#### Password Manager

- Stores display name, URL, username, and password locally.
- Matches saved accounts by the current tab hostname, including subdomains.
- Supports all accounts, other-site accounts, pagination, copy, show/hide, edit, and delete.
- Supports JSON export/import.
- Encrypts password fields with AES-GCM before writing them to IndexedDB.

#### Domain Switcher

- Saves online-domain and local-domain mapping rules.
- Auto-fills the online domain from the current tab.
- Switches both directions between online and local domains.
- Preserves path, query, and hash.

#### Cookie Viewer

- Saves an API request URL for the current site.
- Captures the real Cookie header with `chrome.webRequest.onBeforeSendHeaders`.
- Matches by origin + pathname and ignores query/hash.
- Stores captured headers in `chrome.storage.session` when available.
- Displays both the full Cookie header and parsed Cookie name/value rows.

#### Text Compare

- Compares left and right text locally.
- Shows Git-style added, removed, and unchanged lines.
- Highlights inline character differences.
- Supports accepting left/right change blocks.
- Opens an Options page for long text comparison and unchanged-line folding.

#### Language Translation

- Uses Chrome's built-in Translator API when available.
- Lets users choose source and target languages.
- Runs translation locally in supported Chrome versions.
- Shows a clear message when Chrome does not support the API or the language pair is unavailable.
- Supports copying translated text.

#### Calculator

- Supports expression input and keypad input.
- Supports decimal numbers, negative numbers, percent, sign toggle, and arithmetic operators.
- Uses a BigInt rational-number engine to avoid JavaScript floating-point errors.
- Does not use `eval` or `Function`.
- Formats large results with thousands separators.
- Shows Chinese result descriptions when the integer part has more than 3 digits.
- Persists expression/result state and keeps the latest 10 calculation history items in Side Panel.

#### Address Navigation

- Stores frequently used website entries with title, URL, and remark.
- Validates website URLs before saving and only accepts `http/https`.
- Completes `example.com` to `https://example.com/`.
- Opens saved websites in a new page from the popup.

#### Todo Items

- Stores todo items locally.
- Supports pending/done state, edit, delete, created time, elapsed days, and summary stats.
- Available in both popup and Side Panel.

### Privacy And Storage

| Data                      | Storage                                          |
| ------------------------- | ------------------------------------------------ |
| Password vault            | IndexedDB, password field encrypted with AES-GCM |
| Password encryption key   | IndexedDB                                        |
| Domain switch rules       | IndexedDB                                        |
| Cookie viewer config      | IndexedDB                                        |
| Captured Cookie header    | `chrome.storage.session` when available          |
| Text compare state        | IndexedDB                                        |
| Language translation text | Not persisted                                    |
| Calculator state/history  | IndexedDB                                        |
| Address navigation items  | IndexedDB                                        |
| Todo items                | IndexedDB                                        |
| Menu and locale settings  | IndexedDB                                        |

### Permissions

| Permission   | Purpose                                             |
| ------------ | --------------------------------------------------- |
| `storage`    | Persist local settings and feature data             |
| `activeTab`  | Read the current tab URL for matching and switching |
| `cookies`    | Fallback Cookie reading by URL                      |
| `webRequest` | Capture outgoing request Cookie headers             |
| `sidePanel`  | Open Chrome Side Panel                              |
| `<all_urls>` | Support user-configured sites and API URLs          |

### Tech Stack

- Manifest V3
- React
- TypeScript
- Vite
- IndexedDB
- Web Crypto API AES-GCM
- Vitest
- fake-indexeddb

### Development

```bash
npm install
npm run dev
npm run test
npm run build
```

Load the extension from `dist/` in `chrome://extensions`. After every production build, reload the extension manually because Vite output filenames include hashes.

### Project Structure

```text
src/
├── background/        # MV3 service worker
├── options/           # long text comparison page
├── popup/             # popup app
├── sidepanel/         # Chrome Side Panel app
└── shared/            # reusable business logic and storage modules
```

### Release

- Manual install guide: [docs/INSTALL.zh-CN.md](docs/INSTALL.zh-CN.md)
- Release checklist: [docs/RELEASE.zh-CN.md](docs/RELEASE.zh-CN.md)

### Development Rules

- Do not upload user data.
- Do not use `eval` or `Function`.
- Do not commit real cookies, tokens, internal domains, private keys, or exported password JSON files.
- Put reusable logic under `src/shared/`.
- Add tests for storage, parsing, encryption, calculation, and diff logic.
