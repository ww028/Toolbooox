import type { Locale } from "./locale";

type Messages = {
  readonly account: string;
  readonly add: string;
  readonly addFirstAccount: string;
  readonly addPassword: string;
  readonly acceptLeft: string;
  readonly acceptRight: string;
  readonly cancel: string;
  readonly accountCopied: string;
  readonly actions: string;
  readonly addressDeleted: string;
  readonly addressInvalidUrl: string;
  readonly addressNavigation: string;
  readonly addressRemark: string;
  readonly addressRemarkPlaceholder: string;
  readonly addressSaved: string;
  readonly addressTitle: string;
  readonly addressTitlePlaceholder: string;
  readonly addressUrlCopied: string;
  readonly addressWebsite: string;
  readonly addressWebsitePlaceholder: string;
  readonly aiAssistant: string;
  readonly aiAssistantEmpty: string;
  readonly aiAssistantFailed: string;
  readonly aiAssistantFullscreen: string;
  readonly aiAssistantGenerating: string;
  readonly aiAssistantGuide: string;
  readonly aiAssistantAlreadyInFullscreen: string;
  readonly aiAssistantInitialize: string;
  readonly aiAssistantInitializationChecking: string;
  readonly aiAssistantInitializationCreating: string;
  readonly aiAssistantInitializationDownloading: string;
  readonly aiAssistantInitializationWarming: string;
  readonly aiAssistantInitialized: string;
  readonly aiAssistantInitializeFirst: string;
  readonly aiAssistantInitializing: string;
  readonly aiAssistantKnowledgeAwaitingConfirmation: string;
  readonly aiAssistantKnowledgeCanceled: string;
  readonly aiAssistantKnowledgeConfirmSave: (
    title: string,
    content: string,
    tags: string
  ) => string;
  readonly aiAssistantKnowledgeContent: string;
  readonly aiAssistantKnowledgeContentPlaceholder: string;
  readonly aiAssistantKnowledgeDeleteConfirm: (title: string) => string;
  readonly aiAssistantKnowledgeEmpty: string;
  readonly aiAssistantKnowledgeEditing: string;
  readonly aiAssistantKnowledgeRequired: string;
  readonly aiAssistantKnowledgeSaved: string;
  readonly aiAssistantKnowledgeTags: string;
  readonly aiAssistantKnowledgeTagsPlaceholder: string;
  readonly aiAssistantKnowledgeTitle: string;
  readonly aiAssistantKnowledgeTitlePlaceholder: string;
  readonly aiAssistantHistory: string;
  readonly aiAssistantNewConversation: string;
  readonly aiAssistantNoHistory: string;
  readonly aiAssistantOpenChat: string;
  readonly aiAssistantPageContextUnavailable: string;
  readonly aiAssistantPopupInitialize: string;
  readonly aiAssistantSidePanelChat: string;
  readonly aiAssistantSidePanelUnavailableInFullscreen: string;
  readonly aiAssistantPopupInitializingHint: string;
  readonly aiAssistantPopupGuideLimits: string;
  readonly aiAssistantPopupGuideOffline: string;
  readonly aiAssistantPopupGuideStrengths: string;
  readonly aiAssistantPopupGuideSummary: string;
  readonly aiAssistantPrompt: string;
  readonly aiAssistantPromptPlaceholder: string;
  readonly aiAssistantReadyToChat: string;
  readonly aiAssistantReasoningCallingModel: string;
  readonly aiAssistantReasoningCheckingKnowledge: string;
  readonly aiAssistantReasoningComposing: string;
  readonly aiAssistantReasoningReadingPage: string;
  readonly aiAssistantSendShortcutHint: string;
  readonly aiAssistantThinking: string;
  readonly aiAssistantTimeout: string;
  readonly aiAssistantUnavailable: string;
  readonly aiAssistantUser: string;
  readonly all: string;
  readonly calculator: string;
  readonly calculatorExpression: string;
  readonly calculatorHelp: string;
  readonly calculatorInvalid: string;
  readonly calculatorHistory: string;
  readonly calculatorPlaceholder: string;
  readonly calculatorResult: string;
  readonly changedText: string;
  readonly clear: string;
  readonly closeSidePanel: string;
  readonly collapseUnchangedLines: (lineCount: number) => string;
  readonly compareText: string;
  readonly cookieViewer: string;
  readonly cookieViewerPrivacy: string;
  readonly cookieList: string;
  readonly cookieName: string;
  readonly cookieValue: string;
  readonly cookieDomain: string;
  readonly cookieFlags: string;
  readonly cookieCopied: string;
  readonly cookiesCopied: string;
  readonly cookiesCleared: string;
  readonly cookiesLoaded: string;
  readonly cookiesLoadFailed: string;
  readonly copy: string;
  readonly copyAll: string;
  readonly copyFailed: string;
  readonly currentSite: string;
  readonly databaseViewer: string;
  readonly delete: string;
  readonly deleteConfirm: (displayName: string) => string;
  readonly deleted: string;
  readonly displayName: string;
  readonly displayNamePlaceholder: string;
  readonly domainSwitcher: string;
  readonly domainSwitcherFailed: string;
  readonly domainSwitcherInvalid: string;
  readonly domainSwitcherNoMatch: string;
  readonly domainSwitcherRequired: string;
  readonly domainSwitcherSwitchedToLocal: string;
  readonly domainSwitcherSwitchedToOnline: string;
  readonly domainRuleDeleted: string;
  readonly domainRuleDeleteConfirm: (onlineDomain: string, localDomain: string) => string;
  readonly domainRuleSaved: string;
  readonly domainRuleSaveFailed: string;
  readonly duplicateAccount: string;
  readonly edit: string;
  readonly editPassword: string;
  readonly export: string;
  readonly exported: string;
  readonly expandUnchangedLines: (lineCount: number) => string;
  readonly failedImport: string;
  readonly failedSave: string;
  readonly frontendDeveloperTools: string;
  readonly hide: string;
  readonly import: string;
  readonly imported: string;
  readonly invalidImport: string;
  readonly invalidRequestUrl: string;
  readonly invalidUrl: string;
  readonly language: string;
  readonly localPasswordManager: string;
  readonly localDomain: string;
  readonly localDomainPlaceholder: string;
  readonly longTextCompare: string;
  readonly longTextCompareHelp: string;
  readonly languageTranslation: string;
  readonly sourceLanguage: string;
  readonly swapLanguages: string;
  readonly targetLanguage: string;
  readonly textToTranslate: string;
  readonly textToTranslatePlaceholder: string;
  readonly translatedText: string;
  readonly translate: string;
  readonly translating: string;
  readonly translationCopied: string;
  readonly translationFailed: string;
  readonly translationHelp: string;
  readonly translationSameLanguage: string;
  readonly translationUnavailable: string;
  readonly menu: string;
  readonly menuOrder: string;
  readonly menuSettings: string;
  readonly menuSettingsHelp: string;
  readonly matchedAccounts: string;
  readonly nextPage: string;
  readonly noActiveSite: string;
  readonly noActiveSiteHelp: string;
  readonly noAddressItems: string;
  readonly noMatch: string;
  readonly noDomainRules: string;
  readonly noCookies: string;
  readonly noCalculatorHistory: string;
  readonly noPasswords: string;
  readonly noTextDiff: string;
  readonly noOtherSitePasswords: string;
  readonly otherSites: string;
  readonly originalText: string;
  readonly onlineDomain: string;
  readonly onlineDomainPlaceholder: string;
  readonly projectAuthor: string;
  readonly projectInfo: string;
  readonly projectRepository: string;
  readonly openLongTextCompareConfirm: string;
  readonly openSidePanel: string;
  readonly openSidePanelDemo: string;
  readonly openWebsite: string;
  readonly pageStatus: (currentPage: number, totalPages: number) => string;
  readonly password: string;
  readonly passwordCopied: string;
  readonly passwordManager: string;
  readonly passwordPlaceholder: string;
  readonly previousPage: string;
  readonly refresh: string;
  readonly lastCapturedRequest: (method: string, url: string) => string;
  readonly requestCookieCaptured: string;
  readonly requestCookieEmpty: string;
  readonly requestCookieFailed: string;
  readonly requestCookieHeader: string;
  readonly requestCookieHeaderHelp: string;
  readonly requestUrl: string;
  readonly requestUrlSaved: string;
  readonly requestUrlPlaceholder: string;
  readonly saveAccount: string;
  readonly save: string;
  readonly saveChanges: string;
  readonly saveDomainRule: string;
  readonly saved: string;
  readonly savedAccounts: string;
  readonly savedDomainRules: string;
  readonly select: string;
  readonly selected: string;
  readonly settings: string;
  readonly send: string;
  readonly show: string;
  readonly sidePanelDemo: string;
  readonly sidePanelDemoHelp: string;
  readonly sidePanelOpenFailed: string;
  readonly saveRequestUrl: string;
  readonly switchDomain: string;
  readonly switchToLocalDomain: string;
  readonly switchToOnlineDomain: string;
  readonly textCompare: string;
  readonly textCompareEmpty: string;
  readonly textCompareHelp: string;
  readonly textCompareResult: string;
  readonly todoContent: string;
  readonly todoContentPlaceholder: string;
  readonly todoCompleteConfirm: (title: string) => string;
  readonly todoDeleted: string;
  readonly todoDeleteConfirm: (title: string) => string;
  readonly todoElapsedDays: (dayCount: number) => string;
  readonly todoItems: string;
  readonly todoRequired: string;
  readonly todoReopenConfirm: (title: string) => string;
  readonly todoSaved: string;
  readonly todoStatsCompleted: string;
  readonly todoStatsPending: string;
  readonly todoStatsTotal: string;
  readonly todoTitle: string;
  readonly todoTitlePlaceholder: string;
  readonly todoUpdated: string;
  readonly todoCreatedAt: string;
  readonly expand: string;
  readonly collapse: string;
  readonly noTodos: string;
  readonly updated: string;
  readonly url: string;
  readonly usernamePlaceholder: string;
  readonly validationRequired: string;
  readonly version: string;
};

export const messages: Record<Locale, Messages> = {
  "zh-CN": {
    account: "账号",
    add: "新增",
    addFirstAccount: "新增第一个账号",
    addPassword: "新增密码",
    acceptLeft: "采用左侧",
    acceptRight: "采用右侧",
    cancel: "取消",
    accountCopied: "账号已复制。",
    actions: "操作",
    addressDeleted: "地址已删除。",
    addressInvalidUrl: "网址不对，请重新检查。",
    addressNavigation: "地址导航",
    addressRemark: "备注",
    addressRemarkPlaceholder: "补充用途、账号或访问说明",
    addressSaved: "地址已保存。",
    addressTitle: "标题",
    addressTitlePlaceholder: "例如：项目文档",
    addressUrlCopied: "网址已复制。",
    addressWebsite: "网站",
    addressWebsitePlaceholder: "https://example.com",
    aiAssistant: "AI 助手",
    aiAssistantEmpty: "暂无对话。",
    aiAssistantFailed: "AI 助手响应失败，请稍后重试。",
    aiAssistantFullscreen: "全屏对话",
    aiAssistantGenerating: "正在生成...",
    aiAssistantGuide: "Chrome 内置离线模型，适合摘要、信息提炼、翻译和轻量写作润色；不联网，不适合复杂推理或专业领域判断。",
    aiAssistantAlreadyInFullscreen: "已经在全屏对话了。",
    aiAssistantInitialize: "初始化本机 AI",
    aiAssistantInitializationChecking: "正在检查本机模型状态...",
    aiAssistantInitializationCreating: "正在创建本机 AI 会话...",
    aiAssistantInitializationDownloading: "正在下载本机模型...",
    aiAssistantInitializationWarming: "正在预热模型，完成后即可提问...",
    aiAssistantInitialized: "本机 AI 已初始化。",
    aiAssistantInitializeFirst: "请先初始化本机 AI。",
    aiAssistantInitializing: "初始化中...",
    aiAssistantKnowledgeAwaitingConfirmation: "请回复「确认」保存，或回复「取消」放弃。",
    aiAssistantKnowledgeCanceled: "已取消写入本地知识库。",
    aiAssistantKnowledgeConfirmSave: (title, content, tags) =>
      [
        "我先整理成这样，确认后再写入本地知识库：",
        "",
        `标题：${title}`,
        tags ? `标签：${tags}` : "",
        `内容：${content}`,
        "",
        "回复「确认」保存，回复「取消」放弃。"
      ].filter(Boolean).join("\n"),
    aiAssistantKnowledgeContent: "内容",
    aiAssistantKnowledgeContentPlaceholder: "粘贴笔记、常用文档、FAQ 或任何希望 AI 记住的资料",
    aiAssistantKnowledgeDeleteConfirm: (title) => `确定删除「${title}」吗？`,
    aiAssistantKnowledgeEmpty: "暂无本地知识片段。",
    aiAssistantKnowledgeEditing: "编辑本地知识",
    aiAssistantKnowledgeRequired: "请填写本地知识标题和内容。",
    aiAssistantKnowledgeSaved: "本地知识已保存。",
    aiAssistantKnowledgeTags: "标签",
    aiAssistantKnowledgeTagsPlaceholder: "可选，用逗号分隔",
    aiAssistantKnowledgeTitle: "本地知识库",
    aiAssistantKnowledgeTitlePlaceholder: "标题，例如：试单流程",
    aiAssistantHistory: "历史对话",
    aiAssistantNewConversation: "新对话",
    aiAssistantNoHistory: "暂无历史对话。",
    aiAssistantOpenChat: "全屏对话",
    aiAssistantPageContextUnavailable: "无法读取当前页面内容，请在普通网页中重试。",
    aiAssistantPopupInitialize: "初始化",
    aiAssistantSidePanelChat: "侧边栏对话",
    aiAssistantSidePanelUnavailableInFullscreen: "全屏对话页面不支持侧边栏对话，请切换到普通网页后再打开。",
    aiAssistantPopupInitializingHint: "正在初始化本机 AI，完成后即可进行对话。",
    aiAssistantPopupGuideLimits: "如果你使用它做复杂推理、专业领域的推理你将获得不好的体验",
    aiAssistantPopupGuideOffline: "该模型是 Chrome 浏览器内置的离线模型，不具备联网搜索的功能",
    aiAssistantPopupGuideStrengths: "对于文本摘要和信息提炼、翻译与多语言处理，写作辅助和文润色可以获得还不错的体验",
    aiAssistantPopupGuideSummary: "这是浏览器里的 \"随身小助手\"，我擅长处理日常、轻量、隐私敏感的文本任务，但别指望可以替代云端大模型做复杂工作",
    aiAssistantPrompt: "输入内容",
    aiAssistantPromptPlaceholder: "向本机 AI 提问",
    aiAssistantReadyToChat: "初始化完成，可以进行对话了。",
    aiAssistantReasoningCallingModel: "调用本机模型生成回答",
    aiAssistantReasoningCheckingKnowledge: "检索本地知识库",
    aiAssistantReasoningComposing: "整理上下文和回答结构",
    aiAssistantReasoningReadingPage: "读取当前页面内容",
    aiAssistantSendShortcutHint: "Enter 发送，Shift+Enter 换行",
    aiAssistantThinking: "思考中...",
    aiAssistantTimeout: "AI 助手响应超时，请直接重试。",
    aiAssistantUnavailable: "当前 Chrome 暂不支持内置 AI 助手，或模型不可用。",
    aiAssistantUser: "你",
    all: "全部",
    calculator: "计算器",
    calculatorExpression: "表达式",
    calculatorHelp: "支持四则运算、小数、括号和负数，可直接输入表达式或点击按钮计算。",
    calculatorHistory: "最近计算",
    calculatorInvalid: "表达式无效",
    calculatorPlaceholder: "例如：1+2*(3-4)",
    calculatorResult: "结果",
    changedText: "修改后文本",
    clear: "清空",
    closeSidePanel: "关闭侧边栏",
    collapseUnchangedLines: (lineCount) => `收起 ${lineCount} 行相同内容`,
    compareText: "比较",
    cookieViewer: "查看 Cookie",
    cookieViewerPrivacy: "仅展示已保存接口请求实际携带的 Cookie header，不会上传到网络中。",
    cookieList: "Cookie 列表",
    cookieName: "名称",
    cookieValue: "值",
    cookieDomain: "域名 / 路径",
    cookieFlags: "标记",
    cookieCopied: "Cookie 已复制。",
    cookiesCopied: "全部 Cookie 已复制。",
    cookiesCleared: "Cookie 展示已清空。",
    cookiesLoaded: "Cookie 已读取。",
    cookiesLoadFailed: "Cookie 读取失败，请确认扩展权限。",
    copy: "复制",
    copyAll: "复制全部",
    copyFailed: "复制失败，请手动复制。",
    currentSite: "当前网站",
    databaseViewer: "数据库",
    delete: "删除",
    deleteConfirm: (displayName) => `确定删除「${displayName}」的密码吗？`,
    deleted: "密码已从本地删除。",
    displayName: "显示名称",
    displayNamePlaceholder: "方便区分这是账号名",
    domainSwitcher: "域名替换",
    domainSwitcherFailed: "域名切换失败。",
    domainSwitcherInvalid: "请输入有效的线上域名和本地开发域名。",
    domainSwitcherNoMatch: "当前网址未命中线上或本地域名。",
    domainSwitcherRequired: "请填写线上域名和本地开发域名。",
    domainSwitcherSwitchedToLocal: "已切换到本地开发域名。",
    domainSwitcherSwitchedToOnline: "已切换到线上域名。",
    domainRuleDeleted: "域名规则已删除。",
    domainRuleDeleteConfirm: (onlineDomain, localDomain) =>
      `确定删除「${onlineDomain} ↔ ${localDomain}」吗？`,
    domainRuleSaved: "域名规则已保存。",
    domainRuleSaveFailed: "域名规则保存失败。",
    duplicateAccount: "当前网站已存在相同账号。",
    edit: "编辑",
    editPassword: "编辑密码",
    export: "导出",
    exported: "密码库已导出。",
    expandUnchangedLines: (lineCount) => `展开 ${lineCount} 行相同内容`,
    failedImport: "密码库导入失败。",
    failedSave: "密码保存失败。",
    frontendDeveloperTools: "前端开发工具",
    hide: "隐藏",
    import: "导入",
    imported: "密码库已导入本地。",
    invalidImport: "导入文件格式无效。",
    invalidRequestUrl: "请输入有效的接口地址。",
    invalidUrl: "请输入有效的网址。",
    language: "语言",
    localPasswordManager: "本地密码管理器",
    localDomain: "本地开发域名",
    localDomainPlaceholder: "localhost:5173",
    longTextCompare: "长文本对比",
    longTextCompareHelp: "适合粘贴较长文本进行全屏对比，所有内容仅在当前浏览器本地处理。",
    languageTranslation: "语言翻译",
    sourceLanguage: "源语言",
    swapLanguages: "对调语言",
    targetLanguage: "目标语言",
    textToTranslate: "原文",
    textToTranslatePlaceholder: "请输入需要翻译的文本",
    translatedText: "译文",
    translate: "翻译",
    translating: "翻译中...",
    translationCopied: "译文已复制。",
    translationFailed: "翻译失败，请检查语言选择或稍后重试。",
    translationHelp: "使用 Chrome 内置 AI 在本机完成翻译；如果模型或语言对不可用，会给出提示。",
    translationSameLanguage: "源语言和目标语言不能相同。",
    translationUnavailable: "当前 Chrome 暂不支持内置翻译，或该语言对不可用。",
    menu: "菜单",
    menuOrder: "菜单顺序",
    menuSettings: "菜单设置",
    menuSettingsHelp: "勾选控制菜单是否显示，拖动条目调整左侧菜单顺序。设置入口始终保留。",
    matchedAccounts: "匹配账号",
    nextPage: "下一页",
    noActiveSite: "未检测到当前网站",
    noActiveSiteHelp: "在网站页面打开插件后，会自动匹配已保存账号。",
    noAddressItems: "还没有保存地址。",
    noMatch: "当前网站没有匹配账号。",
    noDomainRules: "还没有保存域名规则。",
    noCookies: "还没有捕获到该接口请求携带的 Cookie。",
    noCalculatorHistory: "暂无计算记录。",
    noPasswords: "还没有保存密码。",
    noTextDiff: "两侧文本没有差异。",
    noOtherSitePasswords: "没有其他网站账号。",
    otherSites: "其他网站",
    originalText: "原始文本",
    onlineDomain: "线上域名",
    onlineDomainPlaceholder: "www.example.test",
    projectAuthor: "作者",
    projectInfo: "项目信息",
    projectRepository: "GitHub 仓库",
    openLongTextCompareConfirm: "当前文本超过 10 行，更适合使用长文本对比。是否打开长文本对比？",
    openSidePanel: "打开侧边栏",
    openSidePanelDemo: "打开侧边栏 Demo",
    openWebsite: "打开网站",
    pageStatus: (currentPage, totalPages) => `${currentPage} / ${totalPages}`,
    password: "密码",
    passwordCopied: "密码已复制。",
    passwordManager: "密码管理器",
    passwordPlaceholder: "密码存在你的电脑上，并不会上传到网络中",
    previousPage: "上一页",
    refresh: "刷新",
    lastCapturedRequest: (method, url) => `最近捕获：${method} ${url}`,
    requestCookieCaptured: "已获取请求携带的 Cookie。",
    requestCookieEmpty: "已命中接口请求，但没有捕获到 Cookie 请求头。请确认扩展已重新加载并允许读取站点数据。",
    requestCookieFailed: "请求 Cookie 获取失败，请确认扩展权限或接口地址。",
    requestCookieHeader: "请求 Cookie Header",
    requestCookieHeaderHelp: "输入接口地址并保存后，刷新页面或重新触发接口请求，插件会在后台捕获这个接口真实携带的 Cookie header。",
    requestUrl: "接口地址",
    requestUrlSaved: "接口地址已保存，请刷新页面或重新触发接口请求。",
    requestUrlPlaceholder: "https://api.example.test/user/info",
    saveAccount: "保存账号",
    save: "保存",
    saveChanges: "保存修改",
    saveDomainRule: "保存规则",
    saved: "密码已保存到本地。",
    savedAccounts: "已保存账号",
    savedDomainRules: "已保存规则",
    select: "选择",
    selected: "已选中",
    settings: "设置",
    send: "发送",
    show: "显示",
    sidePanelDemo: "侧边栏 Demo",
    sidePanelDemoHelp: "这是 Chrome Side Panel 的最小演示页面，适合放置需要持续查看或频繁操作的工具。",
    sidePanelOpenFailed: "侧边栏打开失败，请确认已重新加载扩展并使用支持 Side Panel 的 Chrome 版本。",
    saveRequestUrl: "保存接口地址",
    switchDomain: "切换域名",
    switchToLocalDomain: "切换为本地",
    switchToOnlineDomain: "切换为线上",
    textCompare: "文本比较",
    textCompareEmpty: "输入左右两侧文本后点击比较。",
    textCompareHelp: "在左右输入框中分别粘贴文本，点击比较后可查看差异，也可像 Git 一样采用左侧或右侧变更。",
    textCompareResult: "比较结果",
    todoContent: "内容",
    todoContentPlaceholder: "补充待办事项的详细内容",
    todoCompleteConfirm: (title) => `确定将「${title}」标记为已办结吗？`,
    todoDeleted: "待办事项已删除。",
    todoDeleteConfirm: (title) => `确定删除「${title}」吗？`,
    todoElapsedDays: (dayCount) => `已进行 ${dayCount} 天`,
    todoItems: "待办事项",
    todoRequired: "请填写待办事项标题。",
    todoReopenConfirm: (title) => `确定重新打开「${title}」吗？`,
    todoSaved: "待办事项已保存。",
    todoStatsCompleted: "已办结",
    todoStatsPending: "待办",
    todoStatsTotal: "总计",
    todoTitle: "标题",
    todoTitlePlaceholder: "请输入待办事项标题",
    todoUpdated: "待办事项已更新。",
    todoCreatedAt: "创建时间",
    expand: "展开",
    collapse: "收起",
    noTodos: "还没有待办事项。",
    updated: "密码已更新到本地。",
    url: "网址",
    usernamePlaceholder: "请输入账号",
    validationRequired: "请填写显示名称、网址和账号。",
    version: "版本"
  },
  en: {
    account: "Account",
    add: "Add",
    addFirstAccount: "Add First Account",
    addPassword: "Add Password",
    acceptLeft: "Accept Left",
    acceptRight: "Accept Right",
    cancel: "Cancel",
    accountCopied: "Account copied.",
    actions: "Actions",
    addressDeleted: "Address deleted.",
    addressInvalidUrl: "The URL is invalid. Please check it again.",
    addressNavigation: "Address Navigation",
    addressRemark: "Remark",
    addressRemarkPlaceholder: "Add usage notes, account hints, or access details",
    addressSaved: "Address saved.",
    addressTitle: "Title",
    addressTitlePlaceholder: "e.g. Project Docs",
    addressUrlCopied: "URL copied.",
    addressWebsite: "Website",
    addressWebsitePlaceholder: "https://example.com",
    aiAssistant: "AI Assistant",
    aiAssistantEmpty: "No conversation yet.",
    aiAssistantFailed: "AI Assistant failed to respond. Try again later.",
    aiAssistantFullscreen: "Fullscreen Chat",
    aiAssistantGenerating: "Generating...",
    aiAssistantGuide: "Chrome built-in offline model for summaries, extraction, translation, and light writing polish. It does not search the web and is not suited for complex reasoning or professional judgment.",
    aiAssistantAlreadyInFullscreen: "Already in fullscreen chat.",
    aiAssistantInitialize: "Initialize Local AI",
    aiAssistantInitializationChecking: "Checking local model status...",
    aiAssistantInitializationCreating: "Creating local AI session...",
    aiAssistantInitializationDownloading: "Downloading local model...",
    aiAssistantInitializationWarming: "Warming up the model. You can ask questions after this finishes...",
    aiAssistantInitialized: "Local AI initialized.",
    aiAssistantInitializeFirst: "Initialize local AI first.",
    aiAssistantInitializing: "Initializing...",
    aiAssistantKnowledgeAwaitingConfirmation: "Reply \"confirm\" to save, or \"cancel\" to discard.",
    aiAssistantKnowledgeCanceled: "Canceled writing to local knowledge.",
    aiAssistantKnowledgeConfirmSave: (title, content, tags) =>
      [
        "I organized it like this. Confirm before I write it to local knowledge:",
        "",
        `Title: ${title}`,
        tags ? `Tags: ${tags}` : "",
        `Content: ${content}`,
        "",
        "Reply \"confirm\" to save, or \"cancel\" to discard."
      ].filter(Boolean).join("\n"),
    aiAssistantKnowledgeContent: "Content",
    aiAssistantKnowledgeContentPlaceholder: "Paste notes, frequent docs, FAQs, or anything you want AI to remember",
    aiAssistantKnowledgeDeleteConfirm: (title) => `Delete "${title}"?`,
    aiAssistantKnowledgeEmpty: "No local knowledge snippets yet.",
    aiAssistantKnowledgeEditing: "Edit Local Knowledge",
    aiAssistantKnowledgeRequired: "Enter a local knowledge title and content.",
    aiAssistantKnowledgeSaved: "Local knowledge saved.",
    aiAssistantKnowledgeTags: "Tags",
    aiAssistantKnowledgeTagsPlaceholder: "Optional, separated by commas",
    aiAssistantKnowledgeTitle: "Local Knowledge",
    aiAssistantKnowledgeTitlePlaceholder: "Title, e.g. Trial order process",
    aiAssistantHistory: "History",
    aiAssistantNewConversation: "New Chat",
    aiAssistantNoHistory: "No chat history yet.",
    aiAssistantOpenChat: "Fullscreen Chat",
    aiAssistantPageContextUnavailable: "Cannot read the current page content. Try again on a regular webpage.",
    aiAssistantPopupInitialize: "Initialize",
    aiAssistantSidePanelChat: "Side Panel Chat",
    aiAssistantSidePanelUnavailableInFullscreen: "Side Panel Chat is not available on the fullscreen chat page. Switch to a regular webpage first.",
    aiAssistantPopupInitializingHint: "Initializing local AI. You can start chatting after it finishes.",
    aiAssistantPopupGuideLimits: "If you use it for complex reasoning or specialized professional reasoning, the experience will be poor.",
    aiAssistantPopupGuideOffline: "This model is an offline model built into Chrome. It does not support web search.",
    aiAssistantPopupGuideStrengths: "It works well for text summarization, information extraction, translation, multilingual processing, writing assistance, and text polishing.",
    aiAssistantPopupGuideSummary: "Think of it as a \"pocket assistant\" in the browser: useful enough for daily, lightweight, privacy-sensitive text tasks, but not a replacement for cloud models on complex work.",
    aiAssistantPrompt: "Message",
    aiAssistantPromptPlaceholder: "Ask the local AI assistant",
    aiAssistantReadyToChat: "Initialization complete. You can start chatting now.",
    aiAssistantReasoningCallingModel: "Calling the local model",
    aiAssistantReasoningCheckingKnowledge: "Searching local knowledge",
    aiAssistantReasoningComposing: "Organizing context and answer shape",
    aiAssistantReasoningReadingPage: "Reading the current page",
    aiAssistantSendShortcutHint: "Enter to send, Shift+Enter for newline",
    aiAssistantThinking: "Thinking...",
    aiAssistantTimeout: "AI Assistant timed out. Try again directly.",
    aiAssistantUnavailable: "Built-in AI Assistant is not supported in this Chrome version, or the model is unavailable.",
    aiAssistantUser: "You",
    all: "All",
    calculator: "Calculator",
    calculatorExpression: "Expression",
    calculatorHelp: "Supports arithmetic, decimals, parentheses, and negative numbers. Type an expression or use the buttons.",
    calculatorHistory: "Recent Calculations",
    calculatorInvalid: "Invalid expression",
    calculatorPlaceholder: "e.g. 1+2*(3-4)",
    calculatorResult: "Result",
    changedText: "Changed Text",
    clear: "Clear",
    closeSidePanel: "Close Side Panel",
    collapseUnchangedLines: (lineCount) => `Collapse ${lineCount} unchanged lines`,
    compareText: "Compare",
    cookieViewer: "View Cookie",
    cookieViewerPrivacy: "Only the Cookie header captured from the saved API request is displayed. Nothing is uploaded.",
    cookieList: "Cookie List",
    cookieName: "Name",
    cookieValue: "Value",
    cookieDomain: "Domain / Path",
    cookieFlags: "Flags",
    cookieCopied: "Cookie copied.",
    cookiesCopied: "All cookies copied.",
    cookiesCleared: "Cookie display cleared.",
    cookiesLoaded: "Cookies loaded.",
    cookiesLoadFailed: "Failed to load cookies. Check extension permissions.",
    copy: "Copy",
    copyAll: "Copy All",
    copyFailed: "Copy failed. Please copy manually.",
    currentSite: "Current site",
    databaseViewer: "Database",
    delete: "Delete",
    deleteConfirm: (displayName) => `Delete password for ${displayName}?`,
    deleted: "Password deleted locally.",
    displayName: "Display name",
    displayNamePlaceholder: "A name that helps you recognize this account",
    domainSwitcher: "Domain Switcher",
    domainSwitcherFailed: "Failed to switch domain.",
    domainSwitcherInvalid: "Enter valid online and local development domains.",
    domainSwitcherNoMatch: "The current URL does not match either domain.",
    domainSwitcherRequired: "Online domain and local development domain are required.",
    domainSwitcherSwitchedToLocal: "Switched to the local development domain.",
    domainSwitcherSwitchedToOnline: "Switched to the online domain.",
    domainRuleDeleted: "Domain rule deleted.",
    domainRuleDeleteConfirm: (onlineDomain, localDomain) =>
      `Delete ${onlineDomain} ↔ ${localDomain}?`,
    domainRuleSaved: "Domain rule saved.",
    domainRuleSaveFailed: "Failed to save domain rule.",
    duplicateAccount: "This account already exists for the current site.",
    edit: "Edit",
    editPassword: "Edit Password",
    export: "Export",
    exported: "Password vault exported.",
    expandUnchangedLines: (lineCount) => `Expand ${lineCount} unchanged lines`,
    failedImport: "Failed to import password vault.",
    failedSave: "Failed to save password.",
    frontendDeveloperTools: "Frontend Developer Tools",
    hide: "Hide",
    import: "Import",
    imported: "Password vault imported locally.",
    invalidImport: "Invalid import file.",
    invalidRequestUrl: "Enter a valid API URL.",
    invalidUrl: "Enter a valid URL.",
    language: "Language",
    localPasswordManager: "Local Password Manager",
    localDomain: "Local development domain",
    localDomainPlaceholder: "localhost:5173",
    longTextCompare: "Long Text Compare",
    longTextCompareHelp: "Designed for comparing longer text in a full-page workspace. All content is processed locally in this browser.",
    languageTranslation: "Language Translation",
    sourceLanguage: "Source Language",
    swapLanguages: "Swap languages",
    targetLanguage: "Target Language",
    textToTranslate: "Source Text",
    textToTranslatePlaceholder: "Enter text to translate",
    translatedText: "Translated Text",
    translate: "Translate",
    translating: "Translating...",
    translationCopied: "Translation copied.",
    translationFailed: "Translation failed. Check the language pair or try again later.",
    translationHelp: "Translate locally with Chrome built-in AI. A message is shown if the model or language pair is unavailable.",
    translationSameLanguage: "Source and target languages must be different.",
    translationUnavailable: "Built-in translation is not supported in this Chrome version, or this language pair is unavailable.",
    menu: "Menu",
    menuOrder: "Menu order",
    menuSettings: "Menu Settings",
    menuSettingsHelp: "Use checkboxes to show or hide menu items, and drag rows to reorder the left menu. Settings always stays available.",
    matchedAccounts: "Matched Accounts",
    nextPage: "Next",
    noActiveSite: "No active site detected",
    noActiveSiteHelp: "Open this popup on a website to match saved accounts.",
    noAddressItems: "No saved addresses yet.",
    noMatch: "No account matches the current website.",
    noDomainRules: "No saved domain rules yet.",
    noCookies: "No cookies have been captured from this API request yet.",
    noCalculatorHistory: "No calculation history yet.",
    noPasswords: "No passwords saved yet.",
    noTextDiff: "No differences found.",
    noOtherSitePasswords: "No accounts for other sites.",
    otherSites: "Other Sites",
    originalText: "Original Text",
    onlineDomain: "Online domain",
    onlineDomainPlaceholder: "www.example.test",
    projectAuthor: "Author",
    projectInfo: "Project Info",
    projectRepository: "GitHub Repository",
    openLongTextCompareConfirm: "The current text is over 10 lines and is better suited for Long Text Compare. Open it now?",
    openSidePanel: "Open Side Panel",
    openSidePanelDemo: "Open Side Panel Demo",
    openWebsite: "Open Website",
    pageStatus: (currentPage, totalPages) => `${currentPage} / ${totalPages}`,
    password: "Password",
    passwordCopied: "Password copied.",
    passwordManager: "Password Manager",
    passwordPlaceholder: "This password stays on your computer and is never uploaded.",
    previousPage: "Previous",
    refresh: "Refresh",
    lastCapturedRequest: (method, url) => `Last captured: ${method} ${url}`,
    requestCookieCaptured: "Request Cookie captured.",
    requestCookieEmpty: "The API request was matched, but no Cookie request header was captured. Reload the extension and allow site-data access.",
    requestCookieFailed: "Failed to capture request Cookie. Check extension permissions or the API URL.",
    requestCookieHeader: "Request Cookie Header",
    requestCookieHeaderHelp: "Enter and save an API URL, then refresh the page or trigger the request again. The background listener captures the Cookie header actually attached to that API request.",
    requestUrl: "API URL",
    requestUrlSaved: "API URL saved. Refresh the page or trigger the request again.",
    requestUrlPlaceholder: "https://api.example.test/user/info",
    saveAccount: "Save Account",
    save: "Save",
    saveChanges: "Save Changes",
    saveDomainRule: "Save Rule",
    saved: "Password saved locally.",
    savedAccounts: "Saved Accounts",
    savedDomainRules: "Saved Rules",
    select: "Select",
    selected: "Selected",
    settings: "Settings",
    send: "Send",
    show: "Show",
    sidePanelDemo: "Side Panel Demo",
    sidePanelDemoHelp: "This is a minimal Chrome Side Panel demo for tools that should stay visible while you browse.",
    sidePanelOpenFailed: "Failed to open the side panel. Reload the extension and use a Chrome version that supports Side Panel.",
    saveRequestUrl: "Save API URL",
    switchDomain: "Switch Domain",
    switchToLocalDomain: "Switch to Local",
    switchToOnlineDomain: "Switch to Online",
    textCompare: "Text Compare",
    textCompareEmpty: "Enter text on both sides, then click Compare.",
    textCompareHelp: "Paste text into the left and right inputs. Review differences and accept left or right changes like a Git merge.",
    textCompareResult: "Compare Result",
    todoContent: "Content",
    todoContentPlaceholder: "Add details for this todo item",
    todoCompleteConfirm: (title) => `Mark "${title}" as done?`,
    todoDeleted: "Todo deleted.",
    todoDeleteConfirm: (title) => `Delete "${title}"?`,
    todoElapsedDays: (dayCount) => `${dayCount} day(s) elapsed`,
    todoItems: "Todo Items",
    todoRequired: "Enter a todo title.",
    todoReopenConfirm: (title) => `Reopen "${title}"?`,
    todoSaved: "Todo saved.",
    todoStatsCompleted: "Done",
    todoStatsPending: "Todo",
    todoStatsTotal: "Total",
    todoTitle: "Title",
    todoTitlePlaceholder: "Enter todo title",
    todoUpdated: "Todo updated.",
    todoCreatedAt: "Created",
    expand: "Expand",
    collapse: "Collapse",
    noTodos: "No todo items yet.",
    updated: "Password updated locally.",
    url: "URL",
    usernamePlaceholder: "Enter account",
    validationRequired: "Display name, URL, and account are required.",
    version: "Version"
  }
};
