# Toolbooox

<div align="center">

**一个本地优先的 Chrome 插件工具库**

`Manifest V3` · `React` · `TypeScript` · `IndexedDB` · `AES-GCM` · `Chrome Storage`

[中文](#中文) | [English](#english)

</div>

---

## 中文

> 帖子类型：项目介绍 / Chrome 插件 / 本地优先工具箱  
> 当前状态：开发中，密码管理器、域名替换、查看 Cookie 可用  
> 隐私原则：业务数据本地保存，不做云同步，不上传密码或 Cookie

### 楼主贴

Toolbooox 是一个本地优先的 Chrome 浏览器插件，定位为日常可复用工具集合。当前版本包含三个核心工具：密码管理器、域名替换、查看 Cookie。所有业务数据都保存在用户自己的浏览器环境中，插件不依赖远端服务。

本仓库采用 MIT 协议开源，欢迎 Fork 和参与开发。

### 帖子目录

- [当前功能](#当前功能)
- [获取与安装](#获取与安装)
- [使用方式](#使用方式)
- [数据与隐私](#数据与隐私)
- [权限说明](#权限说明)
- [技术栈](#技术栈)
- [本地开发](#本地开发)
- [测试覆盖](#测试覆盖)
- [公开仓库提醒](#公开仓库提醒)

### 当前功能

#### 置顶：密码管理器

| 能力         | 说明                                                           |
| ------------ | -------------------------------------------------------------- |
| 本地保存     | 保存显示名称、网址、账号和密码                                 |
| 当前网站匹配 | 打开插件时，根据当前标签页域名展示匹配账号，支持同域和子域匹配 |
| 列表视图     | 使用紧凑列表展示账号，支持 `全部` 和 `其他网站` 两个筛选视图   |
| 分页浏览     | 已保存账号每页展示 10 条，适合账号数量增长后的日常使用         |
| 快捷操作     | 支持复制账号、复制密码、显示/隐藏密码、编辑和删除              |
| 新增与编辑   | 表单位于列表上方，编辑时会自动滚动到表单区域                   |
| 导入导出     | 支持导出 JSON 备份，也支持从 JSON 文件导入并替换本地密码库     |
| 加密落库     | 密码字段写入 IndexedDB 前通过 Web Crypto API 使用 AES-GCM 加密 |

#### 2 楼：域名替换

| 能力       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| 规则保存   | 保存线上域名和本地开发域名的切换规则                      |
| 智能填充   | 根据当前页面 URL 自动填充线上域名，并默认给出本地域名占位 |
| 双向切换   | 当前页面命中线上域名时切到本地，命中本地域名时切回线上    |
| URL 保真   | 切换时保留原路径、查询参数和哈希                          |
| 多规则管理 | 支持保存、选择和删除多组域名规则                          |

#### 3 楼：查看 Cookie

| 能力     | 说明                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 接口配置 | 为当前网站保存一个要观察的接口地址                                             |
| 请求捕获 | 通过后台 `webRequest.onBeforeSendHeaders` 捕获接口请求真实携带的 Cookie header |
| 精确匹配 | 捕获时按接口 origin + pathname 匹配，忽略 query 和 hash                        |
| 会话暂存 | 捕获到的 Cookie header 优先写入 `chrome.storage.session`，不做长期持久化       |
| 结果展示 | 支持展示完整 Cookie header，并拆分成 Cookie 名和值列表                         |
| 操作反馈 | 复制、保存、清空、捕获状态通过固定定位 Toast 反馈                              |

### 获取与安装

| 渠道            | 适用场景                                             | 入口                                                 |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Chrome 应用商店 | 推荐给可访问 Chrome 应用商店的用户，安装和更新更省心 | 待发布                                               |
| GitHub Releases | 适合无法访问 Chrome 应用商店，或需要手动安装包的用户 | <https://github.com/ww028/Toolbooox/releases/latest> |

手动安装需要下载 Release 中的 `toolbooox-v*.zip`，解压后在 `chrome://extensions` 中开启开发者模式并选择 `加载已解压的扩展程序`。

详细步骤见：[手动安装指南](docs/INSTALL.zh-CN.md)。

### 使用方式

#### 密码管理器

1. 在 Chrome 中点击 Toolbooox 插件图标。
2. 点击 `新增`，填写显示名称、网址、账号和密码。
3. 点击 `保存` 后，账号会保存到本地密码库。
4. 之后在对应网站打开插件，`匹配账号` 会自动展示当前网站相关账号。
5. 使用 `复制`、`显示`、`编辑`、`删除` 管理单条账号。
6. 使用 `导出` 备份密码库，使用 `导入` 从 JSON 备份恢复数据。

#### 域名替换

1. 打开需要切换的页面。
2. 进入 `域名替换`。
3. 填写线上域名和本地开发域名。
4. 点击 `保存规则` 保存常用配置。
5. 点击切换按钮，插件会在当前标签页中替换域名，并保留路径、参数和哈希。

#### 查看 Cookie

1. 打开需要观察接口请求的页面。
2. 进入 `查看 Cookie`。
3. 填写接口地址并保存，例如 `https://api.example.test/user/info`。
4. 刷新页面或重新触发该接口请求。
5. 插件会在后台捕获这个接口真实携带的 Cookie header。

### 数据与隐私

> 置顶提醒：Toolbooox 是本地工具箱，不是云同步服务。

| 项目            | 当前实现                                                                               |
| --------------- | -------------------------------------------------------------------------------------- |
| 网络请求        | 插件不发起业务上传请求；密码和 Cookie 不会上传到服务器                                 |
| 密码主存储      | 浏览器本地 IndexedDB，数据库名为 `toolbooox.passwordVault`                             |
| 密码加密        | 密码字段写入 IndexedDB 前使用 AES-GCM 加密                                             |
| 本地密钥        | AES-GCM 原始密钥保存在本地浏览器存储中                                                 |
| 旧数据迁移      | 旧版本 `chrome.storage.local` 密码数据会在首次读取时自动迁移到 IndexedDB，并清理旧 Key |
| 域名规则        | 域名替换规则保存在 `chrome.storage.local`                                              |
| Cookie 配置     | 要观察的接口地址保存在 `chrome.storage.local`                                          |
| Cookie 捕获结果 | 捕获到的 Cookie header 优先保存在 `chrome.storage.session`，浏览器会话结束后清除       |
| 导出文件        | 密码库 JSON 导出文件包含可恢复的明文账号数据，请只保存在可信位置                       |

当前版本的本地加密用于防止密码以明文直接落库；如果本地浏览器数据被完整读取，仍应视为存在被解密风险。后续可加入主密码和密钥派生机制，进一步提升本地数据保护强度。

### 权限说明

| 权限         | 用途                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `storage`    | 保存语言、菜单状态、密码密钥、域名规则、Cookie 观察配置和会话捕获结果 |
| `activeTab`  | 读取当前标签页 URL，用于账号匹配、域名替换和当前网站展示              |
| `cookies`    | 在查看 Cookie 功能中按接口 URL 读取 Cookie 作为兜底展示               |
| `webRequest` | 捕获指定接口请求实际携带的 Cookie header                              |
| `<all_urls>` | 允许在用户保存的任意站点/API 地址上做域名匹配和请求监听               |

### 技术栈

| 分类       | 技术                                                          |
| ---------- | ------------------------------------------------------------- |
| 插件规范   | Manifest V3                                                   |
| 前端框架   | React                                                         |
| 构建工具   | Vite                                                          |
| 语言       | TypeScript                                                    |
| 浏览器能力 | Chrome Storage / Active Tab / Cookies / WebRequest            |
| 国际化     | Chrome 原生 i18n (`_locales`)                                 |
| 本地存储   | IndexedDB / `chrome.storage.local` / `chrome.storage.session` |
| 密码加密   | Web Crypto API AES-GCM                                        |
| 单元测试   | Vitest + fake-indexeddb                                       |

### 本地开发

#### 1 楼：安装与构建

```bash
npm install
npm run build
```

构建产物会输出到 `dist/` 目录。在 Chrome 中打开 `chrome://extensions`，开启开发者模式后，选择 `dist/` 作为已解压的扩展程序加载。

#### 2 楼：常用脚本

```bash
npm run dev      # 启动 Vite 开发服务
npm run build    # 类型检查并构建扩展
npm run test     # 运行单元测试
npm run preview  # 预览构建结果
```

发布新版本前，请按 [发布流程](docs/RELEASE.zh-CN.md) 完成测试、隐私扫描、打包和 Release 检查。

### 测试覆盖

当前单元测试覆盖：

- 密码库 IndexedDB 加密写入与解密读取。
- 无效网址校验。
- 同一网站相同账号去重。
- 无效导入数据不覆盖已有数据。
- 旧 `chrome.storage.local` 数据自动迁移到 IndexedDB。
- 域名替换的 URL 保真、双向切换和规则管理。
- Cookie 捕获 URL 匹配、当前页面域名匹配和 Cookie header 解析。

### 公开仓库提醒

- 仓库内示例域名使用 `.test` 保留域，避免混入真实业务域名。
- `package-lock.json` 使用公开 npm registry，不保留内部依赖源。
- 不要提交 `toolbooox-passwords-*.json` 导出文件；该文件包含明文账号数据。
- 不要把真实 Cookie、token、私钥、内部域名或截图放入仓库。

### 回复区

**Q：这是云端密码管理器吗？**  
A：不是。当前版本只做本地保存，不提供云同步。

**Q：密码或 Cookie 是否会上传？**  
A：不会。插件不发起业务上传请求，密码和 Cookie header 不会上传到服务器。

**Q：导出的 JSON 是否安全？**  
A：导出文件包含可恢复的明文账号数据，需要自行妥善保管。

**Q：为什么需要 `<all_urls>`？**  
A：域名替换和 Cookie 查看需要支持用户输入的任意站点/API 地址。实际展示和捕获逻辑仍按当前网站和已保存接口配置做匹配。

---

## English

> Post type: Project introduction / Chrome extension / Local-first toolbox  
> Current status: In development, Password Manager, Domain Switcher, and Cookie Viewer are available  
> Privacy principle: Local storage, no cloud sync, no password or Cookie upload

### Original Post

Toolbooox is a local-first Chrome extension designed as a reusable everyday toolbox. The current version includes three core tools: Password Manager, Domain Switcher, and Cookie Viewer. Business data stays in the user's browser environment, and the extension does not depend on a remote service.

This repository is open sourced under the MIT License. Forks and contributions are welcome.

### Thread Index

- [Current Features](#current-features)
- [Get and Install](#get-and-install)
- [Usage](#usage)
- [Data and Privacy](#data-and-privacy)
- [Permissions](#permissions)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Test Coverage](#test-coverage)
- [Public Repository Checklist](#public-repository-checklist)

### Current Features

#### Pinned: Password Manager

| Capability            | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Local save            | Save display name, URL, account, and password                                                           |
| Current site matching | Match saved accounts from the active tab domain, including same-domain and subdomain matches            |
| List view             | Compact account list with `All` and `Other Sites` filters                                               |
| Pagination            | Saved accounts are shown 10 per page                                                                    |
| Quick actions         | Copy account, copy password, show/hide password, edit, and delete                                       |
| Add and edit flow     | The form is placed above the list, and editing scrolls back to the form area                            |
| Import and export     | Export a JSON backup and import from a JSON file to replace the local vault                             |
| Encrypted storage     | Password fields are encrypted with AES-GCM through the Web Crypto API before being written to IndexedDB |

#### Reply 2: Domain Switcher

| Capability       | Description                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Saved rules      | Save online-domain and local-development-domain pairs                                           |
| Smart prefill    | Prefill the online domain from the current page URL and provide a local development placeholder |
| Two-way switch   | Switch from online to local, or from local back to online                                       |
| URL preservation | Preserve the original path, query string, and hash                                              |
| Rule management  | Save, select, and delete multiple domain rules                                                  |

#### Reply 3: Cookie Viewer

| Capability      | Description                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- |
| API config      | Save one API URL to observe for the current website                                                 |
| Request capture | Capture the Cookie header actually attached to the API request via `webRequest.onBeforeSendHeaders` |
| Exact matching  | Match by API origin + pathname while ignoring query strings and hashes                              |
| Session storage | Store captured Cookie headers in `chrome.storage.session` first, avoiding long-term persistence     |
| Result view     | Display the full Cookie header and split it into name/value rows                                    |
| Feedback        | Save, copy, clear, and capture states use fixed-position Toast feedback                             |

### Get and Install

| Channel          | Best for                                                                                 | Link                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Chrome Web Store | Recommended when the Chrome Web Store is accessible. Installation and updates are easier | To be published                                      |
| GitHub Releases  | Manual installation when the Chrome Web Store is unavailable                             | <https://github.com/ww028/Toolbooox/releases/latest> |

Manual installation requires downloading `toolbooox-v*.zip` from a Release, extracting it, opening `chrome://extensions`, enabling Developer mode, and choosing `Load unpacked`.

Chinese guide: [Manual installation guide](docs/INSTALL.zh-CN.md).

### Usage

#### Password Manager

1. Click the Toolbooox extension icon in Chrome.
2. Click `Add`, then fill in display name, URL, account, and password.
3. Click `Save` to store the account in the local vault.
4. When you open the popup on the related website, `Matched Accounts` shows relevant accounts automatically.
5. Use `Copy`, `Show`, `Edit`, and `Delete` to manage individual accounts.
6. Use `Export` to back up the vault and `Import` to restore from a JSON backup.

#### Domain Switcher

1. Open the page you want to switch.
2. Go to `Domain Switcher`.
3. Enter the online domain and the local development domain.
4. Click `Save Rule` to keep the pair.
5. Click the switch button. The extension updates the active tab URL while preserving path, query string, and hash.

#### Cookie Viewer

1. Open the page that triggers the API request.
2. Go to `View Cookie`.
3. Enter and save an API URL, for example `https://api.example.test/user/info`.
4. Refresh the page or trigger that API request again.
5. The background listener captures the Cookie header actually attached to that API request.

### Data and Privacy

> Pinned note: Toolbooox is a local toolbox, not a cloud sync service.

| Item                   | Current implementation                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Network requests       | The extension does not make business upload requests. Passwords and Cookie headers are not uploaded                            |
| Password storage       | Browser IndexedDB, database `toolbooox.passwordVault`                                                                          |
| Password encryption    | Password fields are encrypted with AES-GCM before being written                                                                |
| Local key              | The raw AES-GCM key is stored in local browser storage                                                                         |
| Legacy migration       | Previous `chrome.storage.local` password data is migrated to IndexedDB automatically on first read, and the old key is removed |
| Domain rules           | Domain switcher rules are stored in `chrome.storage.local`                                                                     |
| Cookie config          | The API URL to observe is stored in `chrome.storage.local`                                                                     |
| Captured Cookie result | Captured Cookie headers are stored in `chrome.storage.session` first and cleared with the browser session                      |
| Export file            | JSON exports contain plaintext account data that can restore the vault. Store them only in trusted locations                   |

Current local encryption prevents passwords from being written as plaintext directly. A full read of local browser data should still be treated as decryptable. A master password and key derivation flow can further strengthen local data protection in a future version.

### Permissions

| Permission   | Purpose                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `storage`    | Save locale, menu state, password key, domain rules, Cookie viewer config, and session capture results |
| `activeTab`  | Read the current tab URL for account matching, domain switching, and current-site display              |
| `cookies`    | Read cookies for the API URL as a Cookie Viewer fallback                                               |
| `webRequest` | Capture the Cookie header actually attached to a saved API request                                     |
| `<all_urls>` | Support user-entered site/API URLs for matching and request listening                                  |

### Tech Stack

| Category             | Technology                                                    |
| -------------------- | ------------------------------------------------------------- |
| Extension spec       | Manifest V3                                                   |
| Frontend             | React                                                         |
| Build tool           | Vite                                                          |
| Language             | TypeScript                                                    |
| Browser APIs         | Chrome Storage / Active Tab / Cookies / WebRequest            |
| Internationalization | Chrome native i18n (`_locales`)                               |
| Local storage        | IndexedDB / `chrome.storage.local` / `chrome.storage.session` |
| Password encryption  | Web Crypto API AES-GCM                                        |
| Unit tests           | Vitest + fake-indexeddb                                       |

### Local Development

#### Reply 1: Install and Build

```bash
npm install
npm run build
```

The build output is written to `dist/`. Open `chrome://extensions` in Chrome, enable Developer mode, and load `dist/` as an unpacked extension.

#### Reply 2: Common Scripts

```bash
npm run dev      # Start the Vite dev server
npm run build    # Type-check and build the extension
npm run test     # Run unit tests
npm run preview  # Preview the build output
```

Before publishing a new version, follow the [release process](docs/RELEASE.zh-CN.md) for testing, privacy scanning, packaging, and Release checks.

### Test Coverage

Current unit tests cover:

- Encrypted IndexedDB writes and decrypted reads for the password vault.
- Invalid URL validation.
- Duplicate account prevention for the same website.
- Invalid import payloads preserving existing data.
- Automatic migration from legacy `chrome.storage.local` data to IndexedDB.
- Domain switching with URL preservation, two-way switching, and rule management.
- Cookie capture URL matching, current-page hostname matching, and Cookie header parsing.

### Public Repository Checklist

- Example domains use the reserved `.test` suffix to avoid real business domains.
- `package-lock.json` uses the public npm registry and does not keep internal registry URLs.
- Do not commit `toolbooox-passwords-*.json` exports; those files contain plaintext account data.
- Do not commit real Cookie headers, tokens, private keys, internal domains, or screenshots containing sensitive data.

### Replies

**Q: Is this a cloud password manager?**  
A: No. The current version stores data locally and does not provide cloud sync.

**Q: Are passwords or Cookie headers uploaded?**  
A: No. The extension does not make business upload requests, and passwords or Cookie headers are not uploaded to a server.

**Q: Is the exported JSON safe?**  
A: Export files contain plaintext account data that can restore the vault, so they should be stored carefully.

**Q: Why does the extension need `<all_urls>`?**  
A: Domain Switcher and Cookie Viewer need to support arbitrary site/API URLs entered by the user. Display and capture logic still match against the current website and saved API config.
