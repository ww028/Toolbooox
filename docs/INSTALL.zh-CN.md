# Toolbooox 手动安装指南

如果你无法访问 Chrome 应用商店，可以从 GitHub Releases 下载发布包，然后通过 Chrome 的开发者模式手动加载扩展。

> 下载地址：<https://github.com/ww028/Toolbooox/releases/latest>

## 下载安装包

1. 打开 GitHub Releases 页面。
2. 下载最新版本里的 `toolbooox-v*.zip` 文件。
3. 将 zip 解压到一个固定目录，例如：

```text
~/Applications/Toolbooox
```

不要直接选择 zip 文件，也不要把解压目录放在临时下载目录后又删除。Chrome 手动加载扩展后，会持续读取这个解压目录里的文件。

## 在 Chrome 中加载

1. 打开 Chrome。
2. 地址栏输入：

```text
chrome://extensions
```

3. 打开右上角 `开发者模式`。
4. 点击 `加载已解压的扩展程序`。
5. 选择刚才解压后的目录。
6. 确认扩展列表里出现 `Toolbooox`。

选择目录时，目录内部应该能直接看到：

```text
manifest.json
popup.html
background.js
assets/
```

如果目录里还有一层 `dist/`，说明选错了目录，需要进入下一层再选择。

## 更新版本

1. 下载新的 `toolbooox-v*.zip`。
2. 关闭 Chrome 扩展页面中的 Toolbooox，或保持页面打开。
3. 删除旧的解压目录内容。
4. 将新 zip 解压到同一个目录。
5. 回到 `chrome://extensions`，点击 Toolbooox 卡片上的刷新按钮。

手动安装不会像 Chrome 应用商店那样自动更新，需要用户自己下载新版并替换。

## 安全提醒

- 只从官方 Releases 页面下载安装包。
- 不要安装来源不明的二次打包版本。
- 不要把 `toolbooox-passwords-*.json` 导出文件发给别人或提交到仓库。
- 导出的密码库 JSON 包含明文账号数据，只适合存放在可信位置。
- 如果浏览器提示扩展拥有较高权限，请对照 README 中的权限说明确认用途。

## 常见问题

**Q：为什么不能直接拖 zip 到扩展页面？**  
A：Chrome 手动加载需要选择“已解压”的扩展目录，不能直接加载 zip。

**Q：为什么重启浏览器后扩展不可用了？**  
A：可能是解压目录被删除或移动了。手动加载扩展后，需要保留该目录。

**Q：能不能不用开发者模式？**  
A：从 GitHub zip 手动加载需要开发者模式。普通用户无开发者模式安装，建议使用 Chrome 应用商店版本。

**Q：Edge 可以用吗？**  
A：Microsoft Edge 也支持加载已解压扩展，入口是 `edge://extensions`，流程类似。

**Q：维护者如何制作发布包？**  
A：见 [发布流程](RELEASE.zh-CN.md)。
