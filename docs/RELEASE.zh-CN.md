# Toolbooox 发布流程

这份文档面向项目维护者，用来发布 Chrome 应用商店版本和 GitHub 手动安装包。

## 发布渠道

| 渠道            | 适用人群                                         | 更新方式                    |
| --------------- | ------------------------------------------------ | --------------------------- |
| Chrome 应用商店 | 可访问 Chrome Web Store 的普通用户               | 商店自动更新                |
| GitHub Releases | 无法访问 Chrome Web Store 或需要手动安装包的用户 | 用户手动下载新版 zip 并替换 |

两个渠道使用同一份 `dist/` 构建产物，避免版本行为不一致。

## 发布前检查

发布前先确认工作区状态：

```bash
git status --short --branch
```

确认没有误提交以下内容：

- `toolbooox-passwords-*.json` 密码导出文件。
- 真实 Cookie、token、私钥、账号截图。
- 真实业务域名、内部域名、内部 npm 源。
- 本地临时文件、调试文件、未忽略的构建缓存。

建议执行隐私与内部依赖扫描：

```bash
rg -n -e 'byted|bytedance|boe|scf|bnpm|@byted|@ies|volcengine|byteplus|toolbooox-passwords-[0-9]' .
rg -n -e 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|BEGIN (RSA|OPENSSH|PRIVATE)|client_secret|api[_-]?key|access[_-]?token|authorization:|bearer ' .
```

如果命中 `example.test`、`localhost`、`registry.npmjs.org`、`github.com`、`opencollective.com` 等公开或保留用途域名，可以按上下文判断为正常。

## 测试与构建

执行测试：

```bash
npm run test
```

执行生产构建：

```bash
npm run build
```

构建结果会输出到 `dist/`。发布前检查 `dist/` 顶层必须包含：

```text
manifest.json
popup.html
background.js
assets/
```

## 本地加载验收

1. 打开 `chrome://extensions`。
2. 开启 `开发者模式`。
3. 点击 `加载已解压的扩展程序`。
4. 选择项目里的 `dist/` 目录。
5. 完整验证以下流程：

- 密码管理器：新增、复制、显示/隐藏、编辑、删除、导入、导出。
- 域名替换：保存规则、选择规则、双向切换，确认路径、query、hash 保留。
- 查看 Cookie：保存接口地址、触发请求、展示 Cookie header、复制、清空。
- 中英文切换。
- 关闭并重新打开插件后，确认菜单状态能保留。

## 生成 GitHub Release 安装包

在项目根目录执行：

```bash
npm run build
cd dist
zip -r ../toolbooox-v0.1.0.zip .
cd ..
```

注意：必须在 `dist/` 目录内部执行 zip。这样 zip 顶层会直接包含 `manifest.json`，而不是多一层 `dist/`。

检查 zip 内容：

```bash
unzip -l toolbooox-v0.1.0.zip | sed -n '1,40p'
```

正确结构示例：

```text
manifest.json
popup.html
background.js
assets/
```

## 发布 GitHub Release

1. 打开 GitHub 仓库：<https://github.com/ww028/Toolbooox>
2. 进入 `Releases`。
3. 点击 `Draft a new release`。
4. 创建 tag，例如 `v0.1.0`。
5. Release 标题使用 `Toolbooox v0.1.0`。
6. 上传 `toolbooox-v0.1.0.zip` 到 Release Assets。
7. 在说明里写清楚：

```markdown
## 安装

- Chrome 应用商店：待发布
- 手动安装包：下载本 Release 附件 `toolbooox-v0.1.0.zip`
- 安装文档：https://github.com/ww028/Toolbooox/blob/main/docs/INSTALL.zh-CN.md

## 隐私

- 数据本地保存，不上传密码或 Cookie
- Cookie 捕获结果使用会话级暂存
- 不要分享 `toolbooox-passwords-*.json` 导出文件
```

## 发布 Chrome 应用商店

Chrome 应用商店上传的也是同一份 zip。推荐使用和 GitHub Release 相同的包，降低差异风险。

发布入口：

```text
https://chrome.google.com/webstore/devconsole
```

需要准备：

- 扩展名称：`Toolbooox`
- 简短描述和详细描述。
- 图标：至少 `128x128`，建议同时准备 `16x16`、`48x48`。
- 截图：建议准备 2-4 张，覆盖密码管理器、域名替换、查看 Cookie。
- 隐私政策 URL。
- 权限用途说明。

### 权限说明参考

| 权限         | 审核说明                                                          |
| ------------ | ----------------------------------------------------------------- |
| `storage`    | 保存本地配置、密码密钥、域名规则、Cookie 查看配置和会话捕获结果   |
| `activeTab`  | 读取当前页面 URL，用于账号匹配、域名替换和当前网站展示            |
| `cookies`    | 在用户主动配置接口地址后，读取对应 URL 的 Cookie 作为查看功能兜底 |
| `webRequest` | 捕获用户保存的接口请求实际携带的 Cookie header                    |
| `<all_urls>` | 支持用户对任意站点/API 地址配置域名替换和 Cookie 查看             |

### 隐私表单填写方向

- 不出售用户数据。
- 不向第三方传输用户数据。
- 密码、Cookie header、域名规则都在本地浏览器环境处理。
- 密码字段写入 IndexedDB 前会本地 AES-GCM 加密。
- Cookie header 捕获结果优先保存到 `chrome.storage.session`，不会长期持久化。
- JSON 导出仅由用户主动触发，导出文件由用户自行保管。

## 版本号同步

发布新版本时同步更新：

- `package.json` 的 `version`。
- `public/manifest.json` 的 `version`。
- Release tag 和 zip 文件名。

示例：

```text
package.json: 0.1.1
public/manifest.json: 0.1.1
tag: v0.1.1
zip: toolbooox-v0.1.1.zip
```

## 发布后验证

发布后检查：

- GitHub Release 页面能看到 zip 附件。
- README 的 Releases 链接能跳到最新版本。
- 下载 zip 后可按 [手动安装指南](INSTALL.zh-CN.md) 正常加载。
- Chrome 应用商店后台审核状态正常。
- 商店通过后，应用商店版本和 GitHub Release 版本号一致。

## 回滚策略

如果发现严重问题：

1. GitHub Release 中标记当前版本为 pre-release 或删除问题附件。
2. 提交修复版本并发布新的 patch 版本。
3. Chrome 应用商店中尽快上传修复包。
4. 在 Release notes 和 README 中说明受影响版本。
