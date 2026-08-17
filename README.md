# Toolbooox

[中文](#中文) | [English](#english)

## 中文

Toolbooox 是一个 Chrome 浏览器插件，定位为本地优先的万能工具库。所有工具操作均在本地完成，不会联网处理数据；所有数据也仅保存在用户本地设备中。

本插件代码仓库采用 MIT 协议开源，欢迎大家 Fork 仓库并一起参与开发。

### 当前功能

#### 密码管理器

- 保存账号信息：显示名称、网址、账号、密码。
- 自动匹配当前网站：打开插件时，会根据当前标签页域名展示匹配账号。
- 查看全部账号：已保存账号支持 `全部` 和 `其他网站` 两个视图，默认展示其他网站账号。
- 分页展示：已保存账号每页展示 10 条。
- 快捷操作：支持复制账号、复制密码、显示/隐藏密码、编辑和删除。
- 导入导出：支持导出 JSON 备份，也支持从 JSON 文件导入。
- 中英文切换：支持中文和 English，默认语言为中文。

### 使用方式

1. 在 Chrome 中点击 Toolbooox 插件图标。
2. 点击 `新增`，填写显示名称、网址、账号和密码。
3. 点击 `保存` 后，账号会保存到本地。
4. 之后在对应网站打开插件，`匹配账号` 区域会自动展示当前网站相关账号。
5. 在账号列表中可以复制账号、复制密码、显示密码、编辑或删除。
6. 使用 `导出` 可备份密码库，使用 `导入` 可恢复 JSON 备份。

### 数据与隐私

- 插件不发起网络请求，密码数据不会上传到服务器。
- 密码库主数据保存在浏览器本地 IndexedDB 中。
- 旧版本保存在 `chrome.storage.local` 的数据会在首次打开插件时自动迁移到 IndexedDB。
- 当前密码字段仍是本地明文存储。IndexedDB 解决的是本地结构化存储问题，不等于加密。后续计划加入主密码和 AES-GCM 加密。

### 技术栈

- Manifest V3
- Vite
- TypeScript
- React
- Chrome 原生 i18n (`_locales`)
- IndexedDB

### 本地开发

```bash
npm install
npm run build
```

构建产物会输出到 `dist/` 目录。在 Chrome 中打开 `chrome://extensions`，开启开发者模式后，选择 `dist/` 作为已解压的扩展程序加载。

## English

Toolbooox is a local-first Chrome extension designed as an all-purpose toolbox. All tool operations run locally without sending data over the network, and all data is stored only on the user's local device.

This plugin repository is open sourced under the MIT License. Forks and contributions are welcome.

### Current Features

#### Password Manager

- Save account information: display name, URL, account, and password.
- Match the current website automatically: when the popup opens, matching accounts are shown based on the active tab domain.
- Browse saved accounts: the saved account list supports `All` and `Other Sites` views, with `Other Sites` selected by default.
- Pagination: saved accounts are shown 10 per page.
- Quick actions: copy account, copy password, show/hide password, edit, and delete.
- Import and export: export a JSON backup and import from a JSON file.
- Language switch: supports Chinese and English, with Chinese as the default language.

### Usage

1. Click the Toolbooox extension icon in Chrome.
2. Click `Add`, then fill in display name, URL, account, and password.
3. Click `Save` to store the account locally.
4. When you open the popup on the related website, matching accounts appear in the `Matched Accounts` section.
5. Use the account list to copy account, copy password, show password, edit, or delete.
6. Use `Export` to back up the vault and `Import` to restore from a JSON backup.

### Data and Privacy

- The extension does not make network requests. Password data is not uploaded to any server.
- Password vault data is stored locally in browser IndexedDB.
- Data previously stored in `chrome.storage.local` is migrated to IndexedDB automatically when the popup is opened.
- Password fields are still stored locally in plain text. IndexedDB improves local structured storage, but it is not encryption. Master password and AES-GCM encryption are planned.

### Tech Stack

- Manifest V3
- Vite
- TypeScript
- React
- Chrome native i18n (`_locales`)
- IndexedDB

### Local Development

```bash
npm install
npm run build
```

The build output is written to `dist/`. Open `chrome://extensions` in Chrome, enable Developer mode, and load `dist/` as an unpacked extension.
