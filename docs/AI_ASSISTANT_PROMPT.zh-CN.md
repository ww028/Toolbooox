# AI 助手功能、使用与开发接入指南

本文档面向两类读者：

1. 普通用户：了解 Toolbooox AI 助手能做什么、入口在哪里、怎么使用。
2. 开发者：了解当前能力如何实现、如何维护、如何基于这套方案继续开发。

AI 助手基于 Chrome 内置 `LanguageModel` / Gemini Nano。它是本地优先的浏览器 AI 工具，不依赖云端模型，不具备联网搜索能力，适合处理用户直接提供或当前页面可读取的文本。

## 功能总览

当前 AI 助手支持以下能力：

| 功能 | 用户侧表现 | 实现位置 |
| --- | --- | --- |
| 本机模型初始化 | 首次使用时点击“初始化”，模型可用后进入对话 | `src/popup/main.tsx`、`src/options/main.tsx`、`src/sidepanel/main.tsx`、`src/shared/aiAssistant/chromeLanguageModel.ts` |
| 全屏对话 | 在独立页面中连续聊天，左侧展示历史对话 | `src/options/main.tsx` |
| 侧边栏对话 | 在 Chrome Side Panel 中边浏览网页边聊天 | `src/sidepanel/main.tsx` |
| 右键选中文本处理 | 选中网页文本后可摘要、翻译、解释、改写 | `src/background/main.ts`、`src/shared/aiAssistant/contextPrompt.ts` |
| 当前页面内容读取 | 在侧边栏提问“总结当前页面”等问题时读取当前 Tab 正文 | `src/shared/chrome/pageContent.ts`、`src/sidepanel/main.tsx` |
| 本地知识库 | 保存常用信息、文档、FAQ，提问时自动检索相关片段 | `src/shared/aiAssistant/knowledgeBase.ts`、`src/popup/main.tsx` |
| 聊天内写入知识库 | 对话中说“记住/保存到知识库”，确认后写入本地知识库 | `src/options/main.tsx`、`src/sidepanel/main.tsx` |
| 上下文管理 | 保留最近对话和滚动摘要，支持连续追问 | `src/shared/aiAssistant/chromeLanguageModel.ts`、`src/shared/aiAssistant/storage.ts` |
| 对话历史持久化 | 保存最多 30 条历史会话，刷新后可恢复 | `src/shared/aiAssistant/storage.ts` |
| 流式输出 | AI 回复逐步显示，失败和超时有提示 | `src/shared/aiAssistant/chromeLanguageModel.ts` |
| 键盘快捷键 | `Enter` 发送，`Shift + Enter` 换行 | `src/options/main.tsx`、`src/sidepanel/main.tsx` |

## 适合与不适合的场景

适合：

- 文本摘要、信息提炼、要点整理。
- 中英文互译、多语言短文本处理。
- 写作辅助、润色、改写。
- 当前网页内容的轻量问答和总结。
- 基于本地知识库的个人信息、常用流程、FAQ 问答。
- 隐私敏感但不需要云端大模型能力的轻量任务。

不适合：

- 联网搜索、实时新闻、最新资料查询。
- 复杂推理、专业领域判断、严肃法律/医疗/财务建议。
- 大规模长文深度分析。
- 严格要求稳定 JSON 或机器可解析格式的自动化流程。
- 替代云端大模型做复杂规划或多工具智能体任务。

## 普通用户怎么用

### 1. 首次初始化

打开扩展 Popup，进入“AI 助手”。

如果页面提示需要初始化，点击“初始化”。初始化期间可能出现以下状态：

- 正在检查本机模型状态。
- 正在下载本机模型。
- 正在创建本机 AI 会话。
- 正在预热模型。

初始化成功后，状态会保存到本地。后续再打开时会直接进入可用状态。这个状态只是体验缓存，如果浏览器模型不可用或调用失败，系统会重新提示初始化。

### 2. 打开全屏对话

在 Popup 的 AI 助手区域点击“全屏对话”。

全屏对话适合长时间聊天和查看历史。页面包含：

- 当前对话区。
- 左侧历史对话列表。
- “新对话”入口。
- 输入框和发送按钮。

输入框支持：

- `Enter` 发送。
- `Shift + Enter` 换行。

如果已经在全屏对话页，再从 Popup 点击“全屏对话”，不会重复打开新页面，会提示“已经在全屏对话了”。

### 3. 打开侧边栏对话

在 Popup 的 AI 助手区域点击“侧边栏对话”。

侧边栏适合边浏览网页边提问。它不会展示完整历史列表，但会加载最近会话，并支持在当前会话中继续提问。

注意：

- 全屏对话页与侧边栏对话互斥。
- 如果当前 Tab 已经是全屏对话页，再尝试打开 AI 侧边栏，会提示“全屏对话页面不支持侧边栏对话，请切换到普通网页后再打开”。
- 打开 Popup 时会隐藏侧边栏；打开侧边栏时会关闭 Popup，避免两个入口同时占用界面。

### 4. 使用右键菜单处理选中文本

在网页中选中一段文本，右键打开 Toolbooox AI 助手菜单。

当前支持：

- 摘要：总结选中文本，给出核心结论和关键要点。
- 翻译：中文翻译成英文，非中文翻译成中文。
- 解释：用通俗语言解释选中文本的含义和上下文。
- 改写：让表达更清晰、自然、专业，并保留原意。

右键菜单会优先打开 AI 侧边栏，并把处理任务填入输入框。用户可以确认、补充或直接发送。

如果 Chrome 当前不支持 `sidePanel.open()`，会降级打开 `sidepanel.html`。

### 5. 让侧边栏读取当前页面

在侧边栏中可以这样提问：

- 总结当前页面。
- 这篇文章讲了什么？
- 帮我提取本页的关键数据。
- What is this page about?

当问题命中“当前页面 / 这篇文章 / this page / webpage”等语义时，侧边栏会尝试读取当前 Tab 的页面标题、URL 和正文，并把内容注入给模型。

限制：

- 只能读取普通网页。
- `chrome://`、扩展页、权限受限页面可能无法读取。
- 页面正文最多注入 12,000 字符，超出会截断。
- 如果无法读取，会提示“无法读取当前页面内容，请在普通网页中重试”。

### 6. 使用本地知识库

本地知识库用于保存希望 AI 记住的资料，例如：

- 个人偏好和基本信息。
- 常用业务流程。
- FAQ。
- 固定术语翻译。
- 常用文档片段。

在 Popup 的 AI 助手区域可以新增、编辑、删除本地知识。每条知识包含：

- 标题。
- 标签，可选，多个标签用逗号分隔。
- 内容。

保存后的知识存放在本地 IndexedDB，不上传云端。

提问时，AI 助手会自动用关键词检索本地知识库，最多取 3 个相关片段注入上下文。如果问题是翻译类请求，会跳过知识库检索，避免知识库内容干扰翻译。

### 7. 在聊天里写入知识库

用户也可以直接在对话中要求保存信息，例如：

```text
我的宠物薯条是银渐层，帮我记到知识库
```

AI 助手会先生成一条待确认信息，提示用户回复“确认”保存，或回复“取消”放弃。

确认后，内容写入本地知识库；取消后不会保存。

这一步需要确认，是为了避免用户普通聊天内容被误写入长期知识。

## 用户侧行为规则

### 对话与入口互斥

当前有三个与 AI 助手相关的界面：

- Popup：负责初始化入口、全屏/侧边栏入口、本地知识库管理。
- 全屏对话页：负责完整对话和历史列表。
- 侧边栏：负责窄屏持续对话、右键选中文本处理、当前页面读取。

互斥规则：

- 打开 Popup 时隐藏侧边栏。
- 从 Popup 打开侧边栏时关闭 Popup。
- 全屏对话页 active 时禁止打开 AI 侧边栏。
- 已经在全屏对话页时，点击“全屏对话”不重复新开页面。

### 右键快捷操作复用当前会话

右键选中文本触发 AI 侧边栏时，会复用当前侧边栏对话。

如果侧边栏已有活跃会话，新的右键任务会填入当前会话输入框，不会强制新建会话，也不会清空已有消息。只有用户主动点击“新对话”才会清空当前对话状态。

### 翻译规则

翻译类请求有最高优先级：

- 中文文本翻译成英文。
- 非中文文本翻译成中文。
- 用户指定目标语言时，按指定目标语言输出。
- 直接输出译文，不额外解释。
- 禁止原样返回源文本。
- 翻译请求跳过本地知识库检索。

## 开发者快速地图

### 核心模块

```text
src/shared/aiAssistant/
  chromeLanguageModel.ts   # Chrome LanguageModel 接入、Prompt 构造、流式输出、摘要
  storage.ts               # 初始化状态、会话历史、滚动摘要持久化
  contextPrompt.ts         # 右键菜单/外部入口生成的临时 prompt
  knowledgeBase.ts         # 本地知识库 CRUD、解析保存意图、检索和知识 prompt

src/shared/chrome/
  pageContent.ts           # 当前页面正文读取和页面上下文 prompt

src/background/
  main.ts                  # 右键菜单注册、选中文本任务生成、侧边栏打开

src/popup/
  main.tsx                 # Popup 初始化入口、全屏/侧边栏入口、本地知识库管理

src/options/
  main.tsx                 # 全屏 AI 对话、历史会话、知识库注入、滚动摘要

src/sidepanel/
  main.tsx                 # 侧边栏 AI 对话、右键任务承接、当前页面读取
```

### 数据存储

| 数据 | 存储位置 | 说明 |
| --- | --- | --- |
| 初始化状态 | IndexedDB key-value，key 为 `toolbooox.aiAssistant.initialized` | 只作为启动体验缓存 |
| 会话历史 | IndexedDB `toolbooox.aiAssistant` / `conversations` | 最多保留 30 条会话 |
| 会话摘要 | `AiAssistantConversation.summary` | 每轮对话后滚动更新 |
| 临时右键 Prompt | `chrome.storage.local` key 为 `toolbooox.aiAssistant.contextPrompt` | 读取后立即删除 |
| 本地知识库 | IndexedDB `toolbooox.aiAssistantKnowledge` / `knowledgeItems` | 最多规范化保留 100 条 |

卸载扩展会清除这些本地数据，包括 IndexedDB、`chrome.storage.local` 和其他扩展本地存储。

## 模型接入实现

核心代码位于 `src/shared/aiAssistant/chromeLanguageModel.ts`。

完整调用链：

1. UI 调用 `initializeChromeLanguageModel(...)`。
2. 通过 `LanguageModel.availability(...)` 检查模型是否可用。
3. 通过 `LanguageModel.create(...)` 创建 session。
4. 传入 system prompt、语言声明和采样参数。
5. 用 `Reply with OK.` 做预热。
6. 用户发送消息。
7. 调用 `createAiAssistantPrompt(...)` 包装用户输入、短期历史和滚动摘要。
8. 优先调用 `session.promptStreaming(...)` 流式输出。
9. 如果当前 session 不支持流式输出，降级到 `session.prompt(...)`。
10. 回复完成后调用 `summarizeAiAssistantConversationTurn(...)` 更新滚动摘要。
11. 将完整消息和摘要保存到 IndexedDB。

### Chrome API 兼容

当前同时兼容两个入口：

```ts
globalThis.LanguageModel
globalThis.ai?.languageModel
```

可用性判断接受这些状态：

```text
available
downloadable
downloading
readily
after-download
```

不可用时 UI 会提示当前 Chrome 暂不支持内置 AI 助手或模型不可用。

### 语言声明

Chrome Prompt API 要求声明输出语言，否则扩展错误页可能出现警告：

```text
No output language was specified in a LanguageModel API request.
```

当前实现：

```ts
const LANGUAGE_MODEL_DECLARED_OUTPUT_LANGUAGE = "en";

const LANGUAGE_MODEL_TEXT_OPTIONS = {
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  outputLanguage: "en"
};
```

这份配置同时传给：

```ts
LanguageModel.availability(LANGUAGE_MODEL_TEXT_OPTIONS);
LanguageModel.create({
  ...LANGUAGE_MODEL_TEXT_OPTIONS,
  systemPrompt,
  monitor
});
```

注意：这里的 `outputLanguage: "en"` 是 Chrome API 能力声明，不等于业务回复语言。业务层仍通过 Prompt 要求默认中文回复，翻译任务则按目标语言输出。

当前没有声明 `expectedInputs`。原因是部分 Chrome 版本只报告支持有限输入语言，强行声明中文输入可能导致可用性判断失败。

### 超时策略

```ts
const LANGUAGE_MODEL_CREATE_TIMEOUT_MS = 120_000;
const LANGUAGE_MODEL_PROMPT_TIMEOUT_MS = 20_000;
const LANGUAGE_MODEL_MEMORY_TIMEOUT_MS = 4_000;
const LANGUAGE_MODEL_WARMUP_TIMEOUT_MS = 30_000;
```

含义：

- 创建 session 可能包含下载和加载，允许 120 秒。
- 正常 Prompt 限制 20 秒。
- 滚动摘要是辅助能力，只允许 4 秒。
- 预热允许 30 秒。

摘要失败不会中断正常对话。

### 采样参数

当前默认：

```ts
const LANGUAGE_MODEL_TEMPERATURE = 0.4;
const LANGUAGE_MODEL_TOP_K = 32;
```

创建 session 前会调用：

```ts
LanguageModel.params();
```

如果浏览器返回 `maxTemperature` 或 `maxTopK`，会将默认值裁剪到浏览器支持范围内。

这组参数更偏稳定，适合摘要、翻译、轻量问答和润色。当前没有按任务动态创建不同 session，因为这会增加初始化成本和 session 生命周期复杂度。

当前没有接入 `maxOutputTokens`。输出长度主要靠 Prompt 约束、上下文截断和超时控制。

## Prompt 设计

### System Prompt

System prompt 只在创建 session 时传入一次，用于定义助手身份和全局边界。

当前核心约束：

- 助手名为“小助”。
- 默认中文回复。
- 翻译任务必须按目标语言输出。
- 默认自然对话，不套固定模板。
- 简单问题不超过 3 句话。
- 不确定时说不确定，不编造。
- 代码、命令和结构化数据保持格式清晰。

### 动态 Prompt

每次用户提问时，不直接把原文传给模型，而是通过 `createAiAssistantPrompt(prompt, options)` 包装。

动态 Prompt 包含：

- 默认回答风格。
- 翻译规则。
- 个人信息和本地知识库指代规则。
- 事实核验规则。
- 复杂任务工作流。
- Few-shot 示例。
- 本次会话滚动摘要。
- 最近 6 条短期对话。
- 当前用户请求。

关键目标：

- 普通问题像自然聊天一样回答。
- 只有用户明确要求时才使用列表、表格或小标题。
- 复杂任务拆成 2-4 个小步骤后直接执行。
- 使用知识库或页面内容时，不暴露“片段”“知识库”“内部证据”等实现细节。
- 个人信息没有直接证据时，不从历史助手回答里编造。

### Few-shot 示例原则

Few-shot 只用于引导风格，不用于固定格式。

推荐：

```text
用户：你是谁
助手：我是 Toolbooox 里的本地 AI 助手，可以帮你做摘要、翻译、润色和轻量问答。

我不联网，所以更适合处理你直接给我的文本。
```

不推荐：

```text
【核心观点】...
【关键数据】...
【行动建议】...
```

固定标签会让模型把普通问题也回答成报告。

## 上下文管理

Gemini Nano 的上下文窗口有限。当前不把完整历史全部塞给模型，而是使用“短期消息 + 中期摘要”。

```ts
const AI_ASSISTANT_CONTEXT_MESSAGE_LIMIT = 6;
const AI_ASSISTANT_CONTEXT_CONTENT_LIMIT = 1_200;
const AI_ASSISTANT_SUMMARY_CONTENT_LIMIT = 800;
```

### 短期消息

短期消息来自最近 6 条用户/助手消息。

处理方式：

- 过滤空消息。
- 每条消息最多保留 1,200 字符。
- 格式化为 `用户: ...` / `助手: ...`。

作用：

- 支持“继续”“刚才第二点”“那这个呢”等连续追问。
- 保留最近几轮的原文细节。

### 滚动摘要

每轮回复结束后，系统会用模型生成一段 1-2 句的中文压缩记忆，写入 `AiAssistantConversation.summary`。

摘要要求：

- 只保留对后续对话有帮助的信息。
- 合并旧摘要和本轮新增信息。
- 不加入用户没有表达过的偏好或事实。
- 不使用标题、列表或解释。

实现细节：

- 优先使用 `session.clone()` 做摘要，避免污染主对话 session。
- 摘要请求超时为 4 秒。
- 摘要失败时沿用旧摘要；没有旧摘要则不写入。
- 旧版本会话没有 `summary` 字段也能正常读取。

### 会话持久化

会话结构：

```ts
export type AiAssistantConversation = {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly messages: AiAssistantStoredMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

保存时会：

- 过滤非法会话。
- 按 `updatedAt` 倒序排序。
- 最多保留 30 条。
- 清空并重写 `conversations` object store。

## 右键菜单实现

右键菜单在 `src/background/main.ts` 中注册，需要 manifest 声明：

```json
{
  "permissions": ["contextMenus", "sidePanel", "storage"]
}
```

菜单只在选中文本时出现：

```ts
chrome.contextMenus.create({
  contexts: ["selection"]
});
```

当前动作：

```ts
type AiAssistantContextMenuAction =
  | "summarize"
  | "translate"
  | "explain"
  | "rewrite";
```

点击后会生成：

```ts
type AiAssistantContextPrompt = {
  readonly input: string;
  readonly prompt: string;
};
```

- `input`：展示给用户和保存到聊天气泡的文本。
- `prompt`：实际发给模型的完整任务指令。

为了避免长文本塞入 URL，右键任务会先写入 `chrome.storage.local`，然后打开侧边栏。侧边栏启动或收到消息后调用 `consumeAiAssistantContextPrompt()` 读取并删除临时任务。

选中文本最大长度：

```ts
const CONTEXT_SELECTION_MAX_LENGTH = 12_000;
```

超出后会截断，并追加“选中文本过长，已截断后续内容”。

## 当前页面内容读取实现

页面读取逻辑位于 `src/shared/chrome/pageContent.ts`。

触发条件由 `shouldUseActivePageContent(prompt)` 判断，命中这些语义时读取页面：

- 当前页面、当前网页、当前网站、当前内容、当前文章。
- 这个页面、这篇文章、本页内容。
- current page、this page、webpage。

读取方式：

```ts
chrome.scripting.executeScript({
  target: { tabId },
  func: () => ({
    title: document.title,
    url: window.location.href,
    text: document.body?.innerText ?? ""
  })
});
```

manifest 需要包含：

```json
{
  "permissions": ["scripting", "activeTab"]
}
```

注入给模型的页面上下文包含：

- 页面标题。
- 页面 URL。
- 页面正文。
- 用户问题。

页面正文最大长度：

```ts
const PAGE_CONTENT_MAX_LENGTH = 12_000;
```

如果无法读取或正文为空，侧边栏会给出明确提示，不让模型假装读过页面。

## 本地知识库实现

本地知识库位于 `src/shared/aiAssistant/knowledgeBase.ts`。

### 数据结构

```ts
export type AiAssistantKnowledgeItem = {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

IndexedDB：

```ts
const DATABASE_NAME = "toolbooox.aiAssistantKnowledge";
const KNOWLEDGE_STORE_NAME = "knowledgeItems";
const MAX_KNOWLEDGE_ITEMS = 100;
```

### CRUD

Popup 提供本地知识的可视化管理：

- 新增。
- 编辑。
- 删除。
- 空状态提示。
- 标题和内容必填校验。

代码入口：

```ts
getAiAssistantKnowledgeItems();
saveAiAssistantKnowledgeItem(draft, existingItem);
deleteAiAssistantKnowledgeItem(itemId);
```

### 聊天内保存

`parseAiAssistantKnowledgeSaveRequest(prompt)` 会识别这些意图：

- 记住。
- 保存。
- 写到知识库。
- 记录到记忆。
- 保存个人信息。

识别到后不会立即写库，而是创建待确认草稿。用户回复“确认/保存/记住”等才会保存；回复“取消/不用/放弃”等会丢弃。

### 检索策略

当前没有使用 embedding 或向量检索，因为 Chrome Nano 暂无稳定 embedding API。

现有方案是轻量关键词/BM25 风格匹配：

- 英文和数字按 token 匹配。
- 中文按 bigram 分词。
- 标题和标签命中加权。
- 内容超过 700 字符会分块。
- 分块之间有 120 字符重叠。
- 最多返回 Top 3 片段。

关键配置：

```ts
const MAX_KNOWLEDGE_SNIPPETS = 3;
const KNOWLEDGE_CHUNK_LENGTH = 700;
const KNOWLEDGE_CHUNK_OVERLAP = 120;
```

翻译类请求通过 `shouldUseAiAssistantKnowledge(query)` 跳过检索：

```text
翻译:
translate:
translation:
```

### 知识 Prompt

检索命中后，`createAiAssistantKnowledgePrompt(...)` 会把片段包装到模型请求中。

关键规则：

- 片段是内部证据，最终回答不能提到检索过程。
- “我”“我的”指用户本人，回答时用“你”“你的”转述。
- 涉及宠物时统一称为“你的宠物”。
- 事实核验必须有直接证据。
- 如果没有足够信息，直接说不知道，不编造。

如果问题涉及个人信息或宠物信息，但知识库没有命中，`createAiAssistantKnowledgeMissingPrompt(...)` 会要求模型自然回答：

```text
我不知道呀，我这里没有这方面的信息。
```

## 全屏对话与侧边栏对话的差异

| 能力 | 全屏对话 | 侧边栏对话 |
| --- | --- | --- |
| 连续聊天 | 支持 | 支持 |
| 历史列表 | 支持 | 不展示完整列表，默认加载最近会话 |
| 新对话 | 支持 | 支持 |
| 右键菜单承接 | 可通过临时 prompt 机制承接，但当前右键优先侧边栏 | 优先承接 |
| 当前页面内容读取 | 不主动读取 | 支持 |
| 输入快捷键 | `Enter` 发送，`Shift + Enter` 换行 | `Enter` 发送，`Shift + Enter` 换行 |
| 本地知识库检索 | 支持 | 支持 |
| 聊天内写入知识库 | 支持 | 支持 |

## UI 与交互约束

开发时需要保持以下约束：

- 全屏对话页与侧边栏对话互斥。
- Popup 与侧边栏互斥。
- 右键快捷操作必须复用当前侧边栏会话，不能自动重置会话。
- 输入框必须支持 `Enter` 发送、`Shift + Enter` 换行。
- 发送按钮旁必须显示快捷键提示。
- 操作失败要用明确文案提示，不要静默失败。
- 侧边栏 AI 模式外层需要固定高度，消息列表作为内部滚动容器。

关键样式约束：

- `.sidepanel-shell-ai` 固定为 `100vh` 并隐藏外层溢出。
- `.ai-sidepanel-chat-list` 是侧边栏 AI 消息滚动容器。
- 侧边栏输入框默认高度为 `112px`，最大高度为 `38vh`。

## 如何基于这套方案开发新能力

### 新增一个 AI 入口

推荐复用现有临时 prompt 机制：

1. 根据业务生成 `AiAssistantContextPrompt`。
2. 调用 `saveAiAssistantContextPrompt({ input, prompt })`。
3. 打开全屏页或侧边栏。
4. 目标页面调用 `consumeAiAssistantContextPrompt()`。
5. 如果用户未修改输入框，发送隐藏的模型 prompt；如果用户修改了输入框，按用户编辑内容发送。

这样可以避免把长文本塞进 URL，也能保持聊天历史干净。

### 新增一个右键动作

需要修改：

- `AI_ASSISTANT_CONTEXT_MENU_ACTIONS`
- `AiAssistantContextMenuAction`
- `createAiAssistantContextPrompt(action, selectionText)`
- 对应测试或手动验证用例

如果新增动作是翻译、结构化抽取、代码解释等容易被默认中文规则影响的任务，必须在 action prompt 中写清楚输出语言和输出格式。

### 新增一种知识库来源

推荐仍写入 `AiAssistantKnowledgeItem`：

```ts
{
  title,
  content,
  tags,
  createdAt,
  updatedAt
}
```

不要把外部来源无条件塞进每次 prompt。应先检索，只注入当前问题相关的 Top 片段。

### 新增页面上下文能力

如果要读取更多页面信息，比如 meta、选区、表格或链接，建议扩展 `ActivePageContent`，并继续通过 `createActivePageContextPrompt(...)` 统一包装。

要注意：

- 受保护页面无法读取。
- 读取结果必须截断。
- 没有读取到内容时必须明确提示用户。
- 不要让模型在没有页面内容时假装已经读取。

### 调整 Prompt

修改 Prompt 时建议按顺序处理：

1. 判断要修的是语气、格式、翻译、知识库、上下文还是 API 兼容。
2. 一次只改一个维度。
3. 更新 `src/shared/aiAssistant/chromeLanguageModel.test.ts` 或 `knowledgeBase.test.ts` 的关键断言。
4. 手动验证全屏对话和侧边栏对话。
5. 再跑构建和测试。

不要把太多业务细节写进 system prompt。业务规则更适合放到动态 prompt、知识 prompt 或具体入口 prompt 中。

## 常见问题排查

### 初始化失败

检查：

- 当前 Chrome 是否支持内置 `LanguageModel` / Gemini Nano。
- `LanguageModel.availability(...)` 和 `LanguageModel.create(...)` 是否传入同一份语言声明。
- 是否缺少 manifest 权限。
- 扩展错误页是否有 API 参数警告。

### 回复太啰嗦

检查：

- system prompt 的长度限制。
- 动态 prompt 是否默认要求列表、小标题或报告格式。
- 是否传入了过多历史消息或页面内容。
- 是否需要缩短知识库片段或页面正文长度。

### 连续追问接不上

检查：

- 发送时是否传入当前会话 `messages`。
- 当前会话 `summary` 是否正常更新和保存。
- 是否错误调用了 `setActiveAiAssistantConversationId(null)`。
- 右键快捷操作是否误清空了消息列表。

### 翻译原样返回

检查：

- 翻译 prompt 是否明确目标语言。
- 是否写了“不要复制源文本”。
- 是否跳过了本地知识库检索。
- 是否被默认中文回复规则覆盖。

### 个人信息问答编造

检查：

- 知识库是否真的有直接证据。
- `createAiAssistantKnowledgeMissingPrompt(...)` 是否被触发。
- 动态 prompt 是否仍要求“没有直接证据就说不知道”。
- 是否把助手旧回答错误当作事实来源。

### 当前页面读取失败

检查：

- 当前 Tab 是否是普通网页。
- manifest 是否有 `scripting` 和 `activeTab` 权限。
- `chrome.scripting.executeScript` 是否可用。
- 页面正文是否为空。

## 验证清单

修改 AI 助手相关逻辑后，至少执行：

```bash
npm run build
npm test
```

建议手动验证：

- Popup 中未初始化、初始化中、初始化完成三种状态。
- 全屏对话能发送消息、流式输出、保存历史。
- 侧边栏能发送消息、自动滚动、复用最近会话。
- `Enter` 发送，`Shift + Enter` 换行。
- 右键摘要、翻译、解释、改写能填入侧边栏。
- 翻译中文时输出英文，翻译英文时输出中文，不原样返回。
- 当前页面读取在普通网页可用，在受限页面有明确提示。
- 本地知识库可新增、编辑、删除。
- 聊天内“记住/确认/取消”流程正常。
- 知识库命中时回答不暴露“片段/知识库/内部证据”等实现词。

## 维护原则

AI 助手当前的定位是本地、轻量、隐私敏感文本助手。开发时优先保证：

- 能力边界清楚。
- 失败提示明确。
- Prompt 不过度模板化。
- 上下文有上限。
- 本地知识可管理、可删除。
- 对话历史和长期知识分开存储。
- 不为了单个场景牺牲翻译、知识库、侧边栏复用等基础行为。

对于 Gemini Nano 这类本地小模型，稳定性通常来自清晰边界、短 Prompt、有限上下文和明确降级，而不是把所有规则都塞进一次请求。
