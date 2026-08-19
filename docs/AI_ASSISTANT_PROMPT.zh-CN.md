# AI 助手 Prompt 设计与接入指南

本文档用于辅助开发者理解、维护和复用 Toolbooox AI 助手的模型约束方案。

它不是产品文案，也不是简单的代码摘录。它回答三个问题：

1. 为什么要这样约束本地模型。
2. 当前实现如何把约束落到代码里。
3. 如果要在其他功能或项目中复用，应该怎么改。

## 已落地优化摘要

当前 AI 助手已落地以下几类模型能力优化：

| 优化项       | 实现方式                                                             | 主要效果                               |
| ------------ | -------------------------------------------------------------------- | -------------------------------------- |
| Prompt 工程  | System prompt + 动态 prompt 包装 + few-shot 风格示例                 | 控制角色、语气、输出边界和默认回答风格 |
| 上下文管理   | 短期最近消息 + 中期滚动摘要                                          | 避免完整历史塞满 Nano 上下文窗口       |
| 持久化实现   | IndexedDB 保存初始化状态、完整消息和会话摘要                         | 刷新或重新打开后恢复历史和压缩记忆     |
| 推理参数优化 | `temperature = 0.4`、`topK = 32`，并按 `LanguageModel.params()` 裁剪 | 提高摘要、翻译、润色、问答场景的稳定性 |
| 工作流拆解   | 动态 prompt 要求复杂任务先拆成 2-4 个小步骤再执行                    | 降低复杂任务一次性处理失败或发散的概率 |
| 右键菜单集成 | 选中文本后通过 context menu 生成任务 prompt，并打开全屏 AI 助手      | 减少复制粘贴，提高网页文本处理效率     |

其中，持久化实现详见“上下文策略 / 持久化实现”，推理参数优化详见“推理参数策略”。

## 适用场景

这套方案适用于基于浏览器内置 `LanguageModel` / Gemini Nano 的轻量 AI 助手，尤其适合：

- 本地优先的浏览器插件。
- 不依赖云端模型的隐私敏感文本工具。
- 摘要、翻译、润色、信息提炼、轻量问答等任务。
- 需要流式输出和连续对话的简单聊天界面。

不适合直接用于：

- 专业领域强推理。
- 需要联网搜索或实时知识的问答。
- 严格结构化输出任务，例如必须返回可解析 JSON 的流程。
- 需要长上下文、高一致性、多轮复杂规划的智能体。

## 设计原则

### 1. 默认自然对话

本地小模型容易被示例和格式要求带偏。如果 prompt 里大量出现固定标题，模型会把普通问答也写成报告。

因此默认约束是：

- 简单问题直接回答。
- 不默认使用「核心观点 / 关键数据 / 行动建议」这类标签。
- 只有用户明确要求总结、对比、计划、清单或表格时，才结构化。

### 2. 先设边界，再设格式

模型首先需要知道自己不能做什么：

- 不联网。
- 不确定时要说不确定。
- 不编造专业判断。
- 翻译任务直接输出目标语言译文，目标语言优先于默认中文回复规则。

格式要求应该服务于任务，而不是压过任务本身。

### 3. 示例只引导风格，不固定模板

Few-shot 示例要短，并且只覆盖高频行为。

不要给模型一整套固定输出模板，除非这个功能本身就是固定格式生成器。AI 助手是通用对话入口，所以示例更关注“自然、简洁、会分段”。

### 4. 上下文要分层

Gemini Nano 是本地小模型。上下文越长，越容易变慢、超时或丢重点。

当前策略不是把完整历史全部塞进 prompt，而是分成两层：

- 短期记忆：最近 6 条消息，完整保留但单条截断。
- 中期记忆：本次会话的滚动摘要，每轮对话后压缩更新。

这样可以支持连续追问，又不会让 prompt 无限增长。

## 当前代码结构

核心实现位于：

- `src/shared/aiAssistant/chromeLanguageModel.ts`

调用入口位于：

- `src/popup/main.tsx`：Popup 内初始化本地模型。
- `src/options/main.tsx`：全屏 AI 助手对话。

测试位于：

- `src/shared/aiAssistant/chromeLanguageModel.test.ts`

## 模型接入流程

AI 助手的完整调用链路如下：

1. 用户点击初始化。
2. 调用 `LanguageModel.availability(...)` 检查模型是否可用。
3. 调用 `LanguageModel.create(...)` 创建 session，并传入 system prompt。
4. 使用一个短 prompt 预热模型。
5. 用户发送消息。
6. 使用 `createAiAssistantPrompt(...)` 包装用户输入、会话摘要和最近上下文。
7. 调用 `session.promptStreaming(...)` 流式输出。
8. 对本轮问答生成新的滚动摘要。
9. 将用户消息、助手回复和会话摘要保存到本地会话历史。

## Chrome API 参数声明

Chrome Prompt API 要求声明预期输出语言，否则扩展错误页会记录类似警告：

```text
No output language was specified in a LanguageModel API request.
```

当前实现使用一份共享配置：

```ts
const LANGUAGE_MODEL_TEXT_OPTIONS = {
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  outputLanguage: "en",
};
```

这份配置必须同时传给：

```ts
LanguageModel.availability(LANGUAGE_MODEL_TEXT_OPTIONS);
LanguageModel.create({
  ...LANGUAGE_MODEL_TEXT_OPTIONS,
  systemPrompt,
  monitor,
});
```

注意：这里的 `outputLanguage: "en"` 是 Chrome API 的能力声明，不等于业务输出语言。业务层默认要求模型用中文回复，但翻译任务会以用户指定的目标语言为准。

当前没有声明 `expectedInputs`。原因是部分 Chrome 版本只报告支持 `[en, es, ja]`，而 Toolbooox 的系统提示和用户输入主要是中文。强行声明中文输入可能导致 API 判定不支持。

复用时建议：

- 如果你的业务输出是英文，保留 `en`。
- 如果你的 Chrome 版本明确支持目标语言，可以改成对应语言。
- `availability()` 和 `create()` 必须保持一致。
- 不要只改 `create()`，否则初始化检查阶段仍可能产生警告。

## System Prompt 模板

System prompt 用于设置整个 session 的基础行为，只在创建 session 时传入一次。

当前模板：

```ts
const AI_ASSISTANT_SYSTEM_PROMPT = [
  "你是我的个人浏览器助手，名字叫「小助」。",
  "工作原则：",
  "1. 默认用中文回复，语气友好但专业；翻译任务必须按用户指定的目标语言输出。",
  "2. 默认像正常对话一样回答，不要套固定模板。",
  "3. 回答简洁，优先给结论；普通问题不超过 3 句话。",
  "4. 需要展开时使用自然段落、列表或表格；段落之间保留空行。",
  "5. 不确定的内容直接说「不确定」，不编造。",
  "6. 涉及代码、命令或结构化数据时，保持格式清晰。",
  "7. 翻译任务直接给出译文，除非用户要求解释；目标语言优先于默认中文回复规则。",
].join("\n");
```

复用时可以保留结构，替换以下内容：

- 助手名字。
- 回复语言。
- 适用任务。
- 禁止事项。
- 格式偏好。

建议不要在 system prompt 里加入过多业务细节。业务细节更适合放到每次请求的动态 prompt 里。

## 动态 Prompt 模板

用户每次提问时，不直接把用户输入传给模型，而是先包装成一个更完整的任务说明。

当前结构：

```text
请处理用户的当前请求。

默认回答风格：
1. 像自然聊天一样回答，不要默认使用固定标签。
2. 简单问题直接回答 1-3 句。
3. 只有用户明确要求总结、对比、计划、清单或表格时，才结构化。
4. 身份问题简短说明即可，不写成报告。
5. 翻译任务直接输出目标语言译文，不受默认中文回复规则影响。
6. 信息不足时说明缺口和下一步。

复杂任务工作流：
1. 如果当前请求包含多个目标、大段文本整理、方案设计、排错或复杂分析，先把任务拆成 2-4 个小步骤。
2. 拆解后直接执行这些步骤，不要只给计划；除非用户明确只要计划。
3. 每个步骤只保留必要结果，避免展开冗长推理过程。
4. 如果无法在一次回答中完成，先完成最关键的一步，并说明下一步该继续处理什么。
5. 简单问答、翻译、改写不需要展示工作流，直接给结果。

示例（只学习风格，不要复述示例）：
用户：你是谁
助手：我是 Toolbooox 里的本地 AI 助手...

处理步骤（在内部完成，不要逐字展示推理过程）：
Step 1: 判断任务是简单请求还是复杂请求
Step 2: 简单请求直接回答；复杂请求先拆成小步骤
Step 3: 提取最近上下文和压缩记忆中的相关信息
Step 4: 按步骤生成简洁、准确、边界清晰的回答

本次会话压缩记忆：
...

最近短期对话上下文：
用户: ...
助手: ...

当前用户请求：
...
```

这个模板由 `createAiAssistantPrompt(prompt, options)` 生成。

复用时可以按任务类型调整：

- 客服助手：增加产品范围、升级人工客服的条件。
- 文档助手：增加引用来源、避免超出文档范围。
- 代码助手：增加语言、框架、输出代码块的要求。
- 翻译工具：删除普通对话示例，强化只输出译文。

## 工作流拆解策略

Gemini Nano 不适合一次性处理过多目标。对于复杂请求，当前方案不引入额外任务 API，而是在 prompt 层要求模型先拆小任务再执行。

### 触发条件

当用户请求具备以下特征时，模型应按工作流处理：

- 同时包含多个目标，例如“总结、提取数据、给建议”。
- 输入内容较长，例如网页内容、会议纪要、邮件长文。
- 需要方案设计、排错、分析、整理。
- 需要先判断材料，再输出结论。

简单问答、翻译、短句改写不触发工作流，直接给结果。

### 当前实现方式

实现位置仍在 `createAiAssistantPrompt(...)`。它会在动态 prompt 中加入“复杂任务工作流”规则：

```text
复杂任务工作流：
1. 如果当前请求包含多个目标、大段文本整理、方案设计、排错或复杂分析，先把任务拆成 2-4 个小步骤。
2. 拆解后直接执行这些步骤，不要只给计划；除非用户明确只要计划。
3. 每个步骤只保留必要结果，避免展开冗长推理过程。
4. 如果无法在一次回答中完成，先完成最关键的一步，并说明下一步该继续处理什么。
5. 简单问答、翻译、改写不需要展示工作流，直接给结果。
```

这不是多 API 编排。当前没有自动调用 `Summarizer`、`Writer`、`Proofreader` 等任务 API，也没有把一次用户请求拆成多次真实模型调用。

它的作用是让同一次 Prompt API 调用内部遵循更稳定的处理顺序：

1. 判断任务类型。
2. 复杂任务拆成小步骤。
3. 按步骤输出必要结果。
4. 避免把完整推理过程暴露给用户。

### 达到的效果

用户侧效果：

- 复杂请求不容易被模型一口气写散。
- 输出更容易按“摘要 / 数据 / 建议”“问题 / 原因 / 处理方式”组织。
- 当一次回答放不下时，模型会优先完成关键部分，并提示下一步继续处理什么。

开发侧效果：

- 不增加新 API 依赖。
- 不改变流式输出和会话持久化逻辑。
- 可以和滚动摘要、短期上下文一起工作。

### 后续可扩展方向

如果后续要做真正的工作流编排，可以在当前 prompt 规则之上增加任务路由层：

- 网页深度整理：先调用 Summarizer API 生成初稿摘要，再用 Prompt API 提取数据和建议。
- 邮件回复：先用 Language Detector 判断语言，再用 Writer 生成草稿，最后用 Proofreader 检查语气和语法。
- 代码排错：先提取错误信息，再定位可能原因，最后生成最小修改建议。

这些都属于多 API 或多步骤编排，会增加状态管理、错误恢复和 UI 进度展示成本。当前阶段先采用 prompt 层工作流约束，成本最低。

## 右键菜单集成

右键菜单用于提升网页文本处理效率。用户选中网页文本后，可以通过 Chrome 右键菜单快速进入 AI 助手处理。

当前支持 4 个动作：

- 摘要
- 翻译
- 解释
- 改写

其中“翻译”动作会显式声明目标语言优先：中文选中文本翻译成英文，非中文选中文本翻译成中文。这样可以避免全局“默认中文回复”约束导致中文原文被原样返回。

### 实现方式

右键菜单在后台 Service Worker 中注册，代码位于：

- `src/background/main.ts`

manifest 需要声明：

```json
"permissions": ["contextMenus"]
```

菜单只在用户选中文本时出现：

```ts
chrome.contextMenus.create({
  contexts: ["selection"],
});
```

点击菜单后，后台脚本会根据动作生成一个结构化任务：

```ts
{
  input: "翻译：\n\n选中文本",
  prompt: "这是翻译任务，目标语言优先于默认中文回复规则。..."
}
```

`input` 是用户可见内容，会显示在输入框和聊天气泡里；`prompt` 是实际发给模型的完整指令。

为了避免长文本塞进 URL，当前不会把选中文本直接拼到 `options.html` 查询参数里，而是先临时写入 `chrome.storage.local`：

```ts
saveAiAssistantContextPrompt({ input, prompt });
```

然后打开全屏 AI 助手：

```ts
options.html?tool=aiAssistant&contextPrompt=1
```

全屏页启动后会调用：

```ts
consumeAiAssistantContextPrompt();
```

读取临时 prompt，并立即删除这条临时数据。

如果用户没有编辑预填输入，发送时会使用隐藏的 `prompt` 调用模型，但聊天历史只显示干净的 `input`。如果用户手动编辑了输入框，隐藏 prompt 会失效，改为按用户编辑后的内容发送。

### 未初始化时的处理

右键菜单不要求 AI 模型已经初始化。

如果用户通过右键菜单打开全屏页时模型还未初始化：

1. 选中文本生成的任务 prompt 会先填入全屏 AI 助手输入框。
2. 页面显示初始化入口。
3. 用户点击初始化并完成后，输入框会自动获得焦点。
4. 光标会移动到预填 prompt 末尾，方便用户确认、补充或直接发送。

当前不会在初始化完成后自动发送。原因是右键选中的文本可能较长，自动发送会让用户失去确认机会，也可能触发非预期模型调用。

### 为什么打开全屏页

当前 AI 助手的对话能力只在全屏页使用，Popup 只负责初始化和入口跳转。

右键菜单不直接在后台运行模型，原因是：

- 模型调用耗时较长，不适合隐藏在 context menu 点击后无反馈执行。
- 全屏页有完整的初始化状态、流式输出、历史保存和错误提示。
- 可以复用现有 prompt 工程、上下文管理、滚动摘要和持久化逻辑。

### 文本长度处理

选中文本会在后台做长度限制：

```ts
const CONTEXT_SELECTION_MAX_LENGTH = 12_000;
```

超过限制时会截断，并在 prompt 末尾追加提示：

```text
[选中文本过长，已截断后续内容。]
```

这样可以避免过长网页内容导致 storage 或模型上下文压力过大。

## Few-shot 示例写法

Few-shot 示例的作用是让模型模仿风格，不是让模型复制格式。

推荐写法：

```text
用户：你是谁
助手：我是 Toolbooox 里的本地 AI 助手，可以帮你做摘要、翻译、润色和轻量问答。

我不联网，所以更适合处理你直接给我的文本。
```

不推荐写法：

```text
用户：你是谁
助手：
【核心观点】...
【关键数据】...
【行动建议】...
```

后者会让模型把普通问题也回答成报告。

## 上下文策略

当前实现使用“滚动摘要 + 最近消息”的组合，而不是完整历史。

```ts
const AI_ASSISTANT_CONTEXT_MESSAGE_LIMIT = 6;
const AI_ASSISTANT_CONTEXT_CONTENT_LIMIT = 1_200;
const AI_ASSISTANT_SUMMARY_CONTENT_LIMIT = 800;
```

### 实现方式总览

当前上下文能力由三部分组成：

1. 会话数据里保存一份可选的 `summary`。
2. 每次请求模型时，同时注入 `summary` 和最近几条原始消息。
3. 每轮助手回复完成后，异步生成新的 `summary` 并随会话一起持久化。

对应代码位置：

- `src/shared/aiAssistant/storage.ts`：定义和持久化 `AiAssistantConversation.summary`。
- `src/shared/aiAssistant/chromeLanguageModel.ts`：构造上下文 prompt，并生成滚动摘要。
- `src/options/main.tsx`：在发送消息时传入摘要，在回复完成后更新摘要。

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

`summary` 是可选字段，旧版本历史会话没有这个字段也能正常读取。读取 IndexedDB 时会通过 `normalizeConversation` 做兼容处理：

```ts
summary: typeof conversation.summary === "string" ? conversation.summary : undefined,
```

### 短期记忆

短期记忆来自最近几条原始消息，用于处理当前追问、指代和上下文衔接。

格式化后的短期上下文：

```text
用户: 第一轮问题
助手: 第一轮回答
```

实现函数是 `formatPromptHistory(...)`。它会：

- 过滤空内容消息。
- 只取最近 `AI_ASSISTANT_CONTEXT_MESSAGE_LIMIT` 条。
- 将单条内容压缩到 `AI_ASSISTANT_CONTEXT_CONTENT_LIMIT` 字符以内。
- 按角色格式化成 `用户: ...` / `助手: ...`。

短期记忆的效果是保留最近对话的原文细节。例如用户连续追问“那刚才第二点呢”，模型还能看到最近几轮的完整表达。

### 中期记忆

中期记忆保存在会话的 `summary` 字段中。每轮助手回复完成后，会调用模型把旧摘要和本轮问答压缩成 1-2 句。

摘要 prompt 的目标是：

- 只保留对后续对话有帮助的信息。
- 合并旧摘要和本轮新增信息。
- 输出 1-2 句中文摘要。
- 不加入用户没有表达过的偏好或事实。

实现上优先使用 `session.clone()` 生成摘要，避免内部摘要请求污染主对话 session。如果当前 Chrome 不支持 clone，则降级为 best-effort；摘要失败不影响正常对话。

具体流程：

1. 用户发起提问。
2. `options/main.tsx` 从当前会话读取 `currentConversation?.summary`。
3. 调用 `askChromeLanguageModelStreaming(...)` 时传入：

```ts
{
  conversationSummary: currentConversation?.summary,
  messages: aiAssistantMessages
}
```

4. `createAiAssistantPrompt(...)` 将摘要注入到正式 prompt：

```text
本次会话压缩记忆：
...

最近短期对话上下文：
用户: ...
助手: ...
```

5. 助手回复完成后，调用 `summarizeAiAssistantConversationTurn(...)`：

```ts
const nextSummary = await summarizeAiAssistantConversationTurn({
  previousSummary: currentConversation?.summary,
  userPrompt: prompt,
  assistantAnswer: nextAnswer,
}).catch(() => currentConversation?.summary ?? "");
```

6. 保存会话时把 `summary: nextSummary || undefined` 一起写入 IndexedDB。

摘要生成使用的内部 prompt 会要求模型：

```text
请为本次本地 AI 助手会话维护一份压缩记忆。

要求：
1. 只保留对后续对话有帮助的信息。
2. 合并旧摘要和本轮新增信息。
3. 输出 1-2 句中文摘要，不要使用标题、列表或解释。
4. 不要加入用户没有表达过的偏好或事实。
```

生成后的摘要还会经过 `normalizeMemorySummary(...)` 清理：

- 去掉首尾引号。
- 合并多余空白。
- 截断到 `AI_ASSISTANT_SUMMARY_CONTENT_LIMIT`。

### 失败降级

摘要生成是辅助能力，不是主链路能力。

因此当前实现采用 best-effort 策略：

- 摘要生成失败时，不中断用户刚刚完成的对话。
- 保存会话时沿用旧摘要。
- 如果没有旧摘要，则不写入 `summary` 字段。

这段逻辑在 `options/main.tsx` 中体现为：

```ts
const nextSummary = await summarizeAiAssistantConversationTurn(...).catch(
  () => currentConversation?.summary ?? ""
);
```

这样可以避免 Nano 短暂超时、clone 不可用或摘要 prompt 失败时影响正常聊天。

### 持久化实现

AI 助手当前有两类持久化数据：初始化状态和对话历史。

#### 初始化状态

初始化状态用于记录本机模型是否已经初始化过，属于体验缓存，不是核心业务数据。

相关代码：

```ts
const AI_ASSISTANT_INITIALIZED_STORAGE_KEY =
  "toolbooox.aiAssistant.initialized";
```

读写入口：

```ts
getSavedAiAssistantInitialized();
saveAiAssistantInitialized(isInitialized);
```

这部分数据存放在通用 key-value IndexedDB 中。写入失败时会静默降级，避免因为缓存状态失败影响 AI 助手初始化。

#### 对话历史

对话历史使用独立 IndexedDB：

```ts
const DATABASE_NAME = "toolbooox.aiAssistant";
const CONVERSATION_STORE_NAME = "conversations";
```

每条会话同时保存完整消息和滚动摘要：

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

保存入口：

```ts
saveAiAssistantConversations(conversations);
```

保存时会先执行 `normalizeConversations(...)`：

- 过滤非法会话。
- 最多保留 30 条会话。
- 按 `updatedAt` 倒序排序。
- 清空 `conversations` object store。
- 将清洗后的会话列表重新写入 IndexedDB。

读取入口：

```ts
getAiAssistantConversations();
```

读取时也会执行 normalize，确保旧数据和异常数据不会直接进入 UI。`summary` 是可选字段，所以旧版本历史会话没有摘要也可以正常恢复。

#### 摘要如何落盘

每轮助手回复完成后，`options/main.tsx` 会生成新的 `nextSummary`，然后和完整消息一起保存：

```ts
await persistAiAssistantConversation({
  id: conversationId,
  title,
  summary: nextSummary || undefined,
  messages: [
    ...aiAssistantMessages,
    userMessage,
    {
      id: assistantMessageId,
      role: "assistant",
      content: nextAnswer,
    },
  ],
  createdAt,
  updatedAt: new Date().toISOString(),
});
```

这意味着：

- `messages` 保存完整对话，用于历史查看。
- `summary` 保存压缩记忆，用于下一轮 prompt 注入。
- 刷新或重新打开全屏页后，会话摘要会随历史会话一起恢复。

### 达到的效果

这套上下文管理解决的是 Gemini Nano 上下文窗口短的问题。

用户侧效果：

- 长对话不会把所有历史都塞进下一轮 prompt，响应更稳定。
- 最近几轮细节仍然保留，适合处理“继续”“刚才那个”“第二点”等追问。
- 较早的关键信息会被压缩进摘要，不会因为只取最近消息而完全丢失。
- 摘要失败时用户无感知，最多只是下一轮少一点中期记忆。

开发侧效果：

- prompt 长度有上限，降低超时概率。
- 会话历史仍完整保存，摘要只是额外字段，不破坏原始记录。
- 旧数据兼容，不需要 IndexedDB 版本迁移。
- 后续可以单独调摘要 prompt、短期消息数量或摘要长度。

### 长期记忆

长期记忆指用户偏好、常用信息、固定背景等跨会话内容。当前 AI 助手没有自动维护长期记忆。

如果后续要实现长期记忆，建议：

- 使用独立存储结构维护。
- 让用户可查看、编辑和删除。
- 只在当前问题相关时注入。
- 不把所有长期记忆无条件塞进 prompt。

复用建议：

- 轻量聊天：4-8 条消息通常够用。
- 摘要或长文本场景：降低历史条数，避免和正文抢上下文。
- 严格任务流程：不要只依赖自然语言历史，关键状态应存成结构化数据。

## 超时策略

当前超时配置：

```ts
const LANGUAGE_MODEL_CREATE_TIMEOUT_MS = 120_000;
const LANGUAGE_MODEL_PROMPT_TIMEOUT_MS = 20_000;
const LANGUAGE_MODEL_WARMUP_TIMEOUT_MS = 30_000;
```

含义：

- 创建 session 可能包含模型下载或加载，允许更长时间。
- 单次 prompt 控制在 20 秒，兼顾右键长文本、首次生成和本地模型响应速度。
- 预热只确认模型可用，不参与正式对话。

复用时建议根据交互方式调整：

- Popup 小窗口：prompt 超时应更短。
- 全屏编辑器：可以适当放宽。
- 长文总结：建议提供明确的加载状态，而不是只加长超时。

## 推理参数策略

Chrome 扩展中的 Prompt API 支持在创建 `LanguageModel` session 时设置采样参数。当前 AI 助手使用会话级参数，而不是每次提问动态创建新 session。

当前配置：

```ts
const LANGUAGE_MODEL_TEMPERATURE = 0.4;
const LANGUAGE_MODEL_TOP_K = 32;
```

实际传给 `LanguageModel.create(...)` 时，会和语言声明一起传入：

```ts
LanguageModel.create({
  ...LANGUAGE_MODEL_TEXT_OPTIONS,
  temperature,
  topK,
  systemPrompt,
  monitor,
});
```

### 参数含义

- `temperature` 控制随机性。值越低，输出越稳定、越少发散。
- `topK` 控制候选 token 的采样范围。值越低，输出越保守。

个人助手默认选择 `temperature = 0.4`、`topK = 32`，原因是当前主要任务是摘要、翻译、润色、轻量问答。这类任务更需要稳定、简洁和少编造，而不是创意发散。

### 浏览器能力裁剪

不同 Chrome 版本暴露的采样参数上限可能不同。当前实现会优先读取：

```ts
LanguageModel.params();
```

如果浏览器返回 `maxTemperature` 或 `maxTopK`，会把默认值裁剪到当前浏览器支持的范围内：

```ts
temperature = Math.min(0.4, maxTemperature);
topK = Math.min(32, maxTopK);
```

如果 `params()` 不存在或调用失败，则使用默认值继续创建 session。

### 为什么不按任务动态调参

Prompt API 的 `temperature` 和 `topK` 是 session 创建参数。当前 AI 助手会缓存并复用同一个 session，以减少初始化成本。

如果每次根据任务动态调参，就需要为不同参数创建不同 session，会带来：

- 更慢的首次响应。
- 更多本地模型资源占用。
- 更复杂的 session 缓存和销毁逻辑。

因此当前采用一组适合个人助手的稳定默认值。

如果后续要支持创意写作、头脑风暴等高发散任务，可以考虑维护两类 session：

- 稳定 session：摘要、翻译、代码、问答。
- 创意 session：脑暴、改写、广告文案。

但这需要额外的 session 生命周期管理，不建议在当前阶段引入。

### 关于 maxOutputTokens

当前没有接入 `maxOutputTokens` 这类硬输出长度参数。

原因是当前 Chrome Prompt API 文档和不同版本实现对该字段的稳定性不如 `temperature` / `topK` 明确。为了避免传入未支持字段导致兼容问题，当前通过 prompt 约束控制输出长度：

- 普通问题不超过 3 句话。
- 摘要压缩为 1-2 句。
- 上下文内容按字符数截断。
- 单次 prompt 设置 20 秒超时。

如果后续 Chrome Prompt API 明确稳定支持输出 token 限制，可以再把它加入 `LanguageModel.create(...)` 或单次 `prompt(...)` 参数中。

## 调参指南

### 回复太生硬

优先检查：

- few-shot 是否太像固定模板。
- 动态 prompt 是否默认要求列表、小标题或标签。
- CSS 是否把回复文字设置得过粗。
- `temperature` / `topK` 是否设置得过低。

### 回复太啰嗦

优先调整：

- system prompt 中的长度限制。
- 动态 prompt 中简单问题的句数限制。
- 是否传入了过多历史上下文。
- 是否需要在 Chrome API 稳定支持后接入输出 token 限制。

### 连续追问接不上

优先调整：

- `AI_ASSISTANT_CONTEXT_MESSAGE_LIMIT`
- 会话 `summary` 是否在每轮后正常更新。
- 上下文格式化方式。
- 是否在发送消息时传入了当前会话历史。

### 初始化出现 Chrome 扩展错误

优先检查：

- `LanguageModel.availability(...)` 是否传了语言声明。
- `LanguageModel.create(...)` 是否传了同一份语言声明。
- 错误页里的上下文是 `popup.html`、`options.html` 还是 `Service Worker`。

## 复用清单

复制这套方案到其他功能时，至少保留以下部分：

- 一份 system prompt，用于定义角色、边界和默认风格。
- 一个动态 prompt 构造函数，用于包装当前请求和上下文。
- 短期记忆限制，避免完整历史无限增长。
- 中期滚动摘要，避免丢失本次会话的关键脉络。
- Chrome API 的 `availability()` 和 `create()` 参数一致性。
- prompt 构造函数的单元测试，防止关键约束被误删。

不建议直接复制的部分：

- 助手名字「小助」。
- Toolbooox 相关描述。
- 中文回复要求，如果目标产品不是中文场景。
- 20 秒 prompt 超时，如果目标任务是极长文本生成。

## 维护原则

修改 prompt 时，尽量遵循以下顺序：

1. 先明确要修的是语气、格式、上下文还是 API 兼容。
2. 只改一个维度，避免无法判断效果来源。
3. 更新 `chromeLanguageModel.test.ts` 中的关键断言。
4. 手动验证 Popup 初始化和全屏对话。
5. 清除 Chrome 扩展错误页旧记录后，再判断是否有新错误。

对于 Gemini Nano 这类本地模型，prompt 不宜追求“大而全”。更稳定的做法是：角色约束清晰、任务边界明确、示例短、上下文有限。
