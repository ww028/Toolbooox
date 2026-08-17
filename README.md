# Toolbooox

[中文](#中文) | [English](#english)

## 中文

Toolbooox 是一个 Chrome 浏览器插件，定位为万能工具库。所有工具操作均在本地完成，不会联网处理数据；所有数据也仅保存在用户本地设备中。

本插件代码仓库采用 MIT 协议开源，欢迎大家 Fork 仓库并一起参与开发。

### 本地开发

```bash
npm install
npm run build
```

构建产物会输出到 `dist/` 目录。在 Chrome 中打开 `chrome://extensions`，开启开发者模式后，选择 `dist/` 作为已解压的扩展程序加载。

## English

Toolbooox is a Chrome extension designed as an all-purpose toolbox. All tool operations run locally without sending data over the network, and all data is stored only on the user's local device.

This plugin repository is open sourced under the MIT License. Forks and contributions are welcome.

### Local Development

```bash
npm install
npm run build
```

The build output is written to `dist/`. Open `chrome://extensions` in Chrome, enable Developer mode, and load `dist/` as an unpacked extension.
