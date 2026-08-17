# Toolbooox

<div align="center">

**一个本地优先的 Chrome 插件工具库**

`Manifest V3` · `React` · `TypeScript` · `IndexedDB` · `AES-GCM` · `Offline First`

[中文](#中文) | [English](#english)

</div>

---

## 中文

> 帖子类型：项目介绍 / Chrome 插件 / 本地密码管理器  
> 当前状态：开发中，核心密码管理功能可用  
> 隐私原则：数据本地保存，不依赖远端服务，不上传密码

### 楼主贴

Toolbooox 是一个本地优先的 Chrome 浏览器插件，定位为日常可复用工具集合。当前版本聚焦密码管理器：账号数据保存在用户自己的浏览器本地，插件不依赖远端服务，也不会把密码上传到网络中。

本仓库采用 MIT 协议开源，欢迎 Fork 和参与开发。

### 帖子目录

- [当前功能](#当前功能)
- [使用方式](#使用方式)
- [数据与隐私](#数据与隐私)
- [技术栈](#技术栈)
- [本地开发](#本地开发)
- [测试覆盖](#测试覆盖)

### 当前功能

#### 置顶：密码管理器

| 能力 | 说明 |
| --- | --- |
| 本地保存 | 保存显示名称、网址、账号和密码 |
| 当前网站匹配 | 打开插件时，根据当前标签页域名展示匹配账号，支持同域和子域匹配 |
| 列表视图 | 使用紧凑列表展示账号，支持 `全部` 和 `其他网站` 两个筛选视图 |
| 分页浏览 | 已保存账号每页展示 10 条，适合账号数量增长后的日常使用 |
| 快捷操作 | 支持复制账号、复制密码、显示/隐藏密码、编辑和删除 |
| 新增与编辑 | 表单位于列表上方，编辑时会自动滚动到表单区域 |
| 导入导出 | 支持导出 JSON 备份，也支持从 JSON 文件导入并替换本地密码库 |
| 双语界面 | 支持中文和 English，默认语言为中文，语言偏好会保存在本地 |
| 操作反馈 | 复制、保存、导入、导出等操作通过非侵入式 Toast 提示反馈结果 |

### 使用方式

像浏览一个工具帖一样，从上到下完成这几步：

1. 在 Chrome 中点击 Toolbooox 插件图标。
2. 点击 `新增`，填写显示名称、网址、账号和密码。
3. 点击 `保存` 后，账号会保存到本地密码库。
4. 之后在对应网站打开插件，`匹配账号` 会自动展示当前网站相关账号。
5. 在 `已保存账号` 中可切换 `全部` 或 `其他网站`，并使用分页浏览更多账号。
6. 使用 `复制`、`显示`、`编辑`、`删除` 管理单条账号。
7. 使用 `导出` 备份密码库，使用 `导入` 从 JSON 备份恢复数据。

### 数据与隐私

> 置顶提醒：Toolbooox 当前是本地密码库，不是云同步密码服务。

| 项目 | 当前实现 |
| --- | --- |
| 网络请求 | 插件不发起业务网络请求，密码数据不会上传到服务器 |
| 主存储 | 浏览器本地 IndexedDB，数据库名为 `toolbooox.passwordVault`，账号表为 `passwordEntries` |
| 密码落库 | 密码字段写入 IndexedDB 前会通过 Web Crypto API 使用 AES-GCM 加密 |
| 数据结构 | 记录中包含 `schemaVersion`、`passwordEncoding`、`encryptionVersion` 和 `iv` 等字段 |
| 本地密钥 | AES-GCM 原始密钥保存在本地浏览器存储中 |
| 旧数据迁移 | 旧版本保存在 `chrome.storage.local` 的密码数据会在首次读取时自动迁移到 IndexedDB，并清理旧 Key |
| 导出文件 | JSON 导出文件包含可恢复的明文账号数据，请只保存在可信位置 |

当前版本的本地加密用于防止密码以明文直接落库；如果本地浏览器数据被完整读取，仍应视为存在被解密风险。后续计划加入主密码和密钥派生机制，进一步提升本地数据保护强度。

### 技术栈

| 分类 | 技术 |
| --- | --- |
| 插件规范 | Manifest V3 |
| 前端框架 | React |
| 构建工具 | Vite |
| 语言 | TypeScript |
| 浏览器能力 | Chrome Storage / Active Tab API |
| 国际化 | Chrome 原生 i18n (`_locales`) |
| 本地存储 | IndexedDB |
| 密码加密 | Web Crypto API AES-GCM |
| 单元测试 | Vitest + fake-indexeddb |

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

### 测试覆盖

当前单元测试重点覆盖密码库核心存储逻辑：

- IndexedDB 加密写入与解密读取。
- 无效网址校验。
- 同一网站相同账号去重。
- 无效导入数据不覆盖已有数据。
- 旧 `chrome.storage.local` 数据自动迁移到 IndexedDB。

### 回复区

**Q：这是云端密码管理器吗？**  
A：不是。当前版本只做本地保存，不提供云同步。

**Q：密码是否会上传？**  
A：不会。插件不发起业务网络请求，密码不会上传到服务器。

**Q：导出的 JSON 是否安全？**  
A：导出文件包含可恢复的明文账号数据，需要自行妥善保管。

---

## English

> Post type: Project introduction / Chrome extension / Local password manager  
> Current status: In development, core password manager features available  
> Privacy principle: Local storage, no remote service dependency, no password upload

### Original Post

Toolbooox is a local-first Chrome extension designed as a reusable everyday toolbox. The current version focuses on a password manager: account data stays in the user's local browser, the extension does not depend on a remote service, and passwords are not uploaded to the network.

This repository is open sourced under the MIT License. Forks and contributions are welcome.

### Thread Index

- [Current Features](#current-features)
- [Usage](#usage)
- [Data and Privacy](#data-and-privacy)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Test Coverage](#test-coverage)

### Current Features

#### Pinned: Password Manager

| Capability | Description |
| --- | --- |
| Local save | Save display name, URL, account, and password |
| Current site matching | Match saved accounts from the active tab domain, including same-domain and subdomain matches |
| List view | Compact account list with `All` and `Other Sites` filters |
| Pagination | Saved accounts are shown 10 per page |
| Quick actions | Copy account, copy password, show/hide password, edit, and delete |
| Add and edit flow | The form is placed above the list, and editing scrolls back to the form area |
| Import and export | Export a JSON backup and import from a JSON file to replace the local vault |
| Bilingual UI | Supports Chinese and English, with Chinese as the default language |
| Operation feedback | Copy, save, import, and export actions use non-intrusive Toast messages |

### Usage

Read it like a tool thread and follow these steps:

1. Click the Toolbooox extension icon in Chrome.
2. Click `Add`, then fill in display name, URL, account, and password.
3. Click `Save` to store the account in the local vault.
4. When you open the popup on the related website, `Matched Accounts` shows relevant accounts automatically.
5. In `Saved Accounts`, switch between `All` and `Other Sites`, and use pagination to browse more entries.
6. Use `Copy`, `Show`, `Edit`, and `Delete` to manage individual accounts.
7. Use `Export` to back up the vault and `Import` to restore from a JSON backup.

### Data and Privacy

> Pinned note: Toolbooox is a local password vault, not a cloud sync password service.

| Item | Current implementation |
| --- | --- |
| Network requests | The extension does not make business network requests. Password data is not uploaded to any server |
| Primary storage | Browser IndexedDB, database `toolbooox.passwordVault`, object store `passwordEntries` |
| Password storage | Password fields are encrypted with AES-GCM through the Web Crypto API before being written |
| Data shape | Stored records include `schemaVersion`, `passwordEncoding`, `encryptionVersion`, and `iv` fields |
| Local key | The raw AES-GCM key is stored in local browser storage |
| Legacy migration | Previous `chrome.storage.local` data is migrated to IndexedDB automatically on first read, and the old key is removed |
| Export file | JSON exports contain plaintext account data that can restore the vault. Store them only in trusted locations |

In the current version, local encryption prevents passwords from being written as plaintext directly. A full read of local browser data should still be treated as decryptable. A master password and key derivation flow is planned to further strengthen local data protection.

### Tech Stack

| Category | Technology |
| --- | --- |
| Extension spec | Manifest V3 |
| Frontend | React |
| Build tool | Vite |
| Language | TypeScript |
| Browser APIs | Chrome Storage / Active Tab API |
| Internationalization | Chrome native i18n (`_locales`) |
| Local storage | IndexedDB |
| Password encryption | Web Crypto API AES-GCM |
| Unit tests | Vitest + fake-indexeddb |

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

### Test Coverage

Current unit tests focus on the password vault storage layer:

- Encrypted IndexedDB writes and decrypted reads.
- Invalid URL validation.
- Duplicate account prevention for the same website.
- Invalid import payloads preserving existing data.
- Automatic migration from legacy `chrome.storage.local` data to IndexedDB.

### Replies

**Q: Is this a cloud password manager?**  
A: No. The current version stores data locally and does not provide cloud sync.

**Q: Are passwords uploaded?**  
A: No. The extension does not make business network requests, and passwords are not uploaded to a server.

**Q: Is the exported JSON safe?**  
A: Export files contain plaintext account data that can restore the vault, so they should be stored carefully.
