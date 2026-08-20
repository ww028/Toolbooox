const DATABASE_NAME = "toolbooox.aiAssistantKnowledge";
const DATABASE_VERSION = 1;
const KNOWLEDGE_STORE_NAME = "knowledgeItems";
const MAX_KNOWLEDGE_ITEMS = 100;
const MAX_KNOWLEDGE_SNIPPETS = 3;
const KNOWLEDGE_CHUNK_LENGTH = 700;
const KNOWLEDGE_CHUNK_OVERLAP = 120;
const KNOWLEDGE_IMPORTANT_SINGLE_TOKENS = new Set(["猫", "狗"]);
const KNOWLEDGE_STOP_TOKENS = new Set([
  "我养",
  "你养",
  "养了",
  "了吗",
  "有没",
  "没有",
  "是否",
  "是不",
  "什么",
  "怎么",
  "如何",
  "这个",
  "那个",
  "我的",
  "你的",
  "是谁",
  "是什",
  "么品"
]);

export type AiAssistantKnowledgeDraft = {
  readonly title: string;
  readonly content: string;
  readonly tags: string;
};

export type AiAssistantKnowledgeItem = AiAssistantKnowledgeDraft & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AiAssistantKnowledgeSnippet = {
  readonly itemId: string;
  readonly title: string;
  readonly tags: string;
  readonly content: string;
  readonly score: number;
};

export type AiAssistantKnowledgeSaveRequest = AiAssistantKnowledgeDraft;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(KNOWLEDGE_STORE_NAME)) {
        const knowledgeStore = database.createObjectStore(KNOWLEDGE_STORE_NAME, {
          keyPath: "id"
        });
        knowledgeStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function normalizeKnowledgeItem(value: unknown): AiAssistantKnowledgeItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<AiAssistantKnowledgeItem>;

  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.content !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    content: item.content,
    tags: typeof item.tags === "string" ? item.tags : "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function normalizeKnowledgeItems(value: unknown): AiAssistantKnowledgeItem[] {
  return mergeKnowledgeItemsByTitle(
    normalizeRawKnowledgeItems(value)
  )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_KNOWLEDGE_ITEMS);
}

function normalizeRawKnowledgeItems(value: unknown): AiAssistantKnowledgeItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeKnowledgeItem)
    .filter((item): item is AiAssistantKnowledgeItem => item !== null);
}

function normalizeDraftText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKnowledgeTitleKey(value: string): string {
  return normalizeDraftText(value).toLowerCase();
}

function mergeKnowledgeTags(left: string, right: string): string {
  return Array.from(
    new Set(
      `${left},${right}`
        .split(/[,，]/u)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).join(", ");
}

function mergeKnowledgeContent(left: string, right: string): string {
  const normalizedLeft = left.trim();
  const normalizedRight = right.trim();

  if (!normalizedLeft) {
    return normalizedRight;
  }

  if (!normalizedRight || normalizedLeft.includes(normalizedRight)) {
    return normalizedLeft;
  }

  if (normalizedRight.includes(normalizedLeft)) {
    return normalizedRight;
  }

  return `${normalizedLeft}\n\n${normalizedRight}`;
}

function mergeKnowledgeItemValues(
  baseItem: AiAssistantKnowledgeItem,
  nextItem: AiAssistantKnowledgeItem
): AiAssistantKnowledgeItem {
  return {
    id: baseItem.id,
    title: baseItem.title,
    content: mergeKnowledgeContent(baseItem.content, nextItem.content),
    tags: mergeKnowledgeTags(baseItem.tags, nextItem.tags),
    createdAt:
      baseItem.createdAt <= nextItem.createdAt ? baseItem.createdAt : nextItem.createdAt,
    updatedAt:
      baseItem.updatedAt >= nextItem.updatedAt ? baseItem.updatedAt : nextItem.updatedAt
  };
}

function mergeKnowledgeItemsByTitle(
  items: readonly AiAssistantKnowledgeItem[]
): AiAssistantKnowledgeItem[] {
  const mergedItems = new Map<string, AiAssistantKnowledgeItem>();

  items.forEach((item) => {
    const titleKey = normalizeKnowledgeTitleKey(item.title);

    if (!titleKey) {
      return;
    }

    const existingItem = mergedItems.get(titleKey);
    mergedItems.set(
      titleKey,
      existingItem ? mergeKnowledgeItemValues(existingItem, item) : item
    );
  });

  return Array.from(mergedItems.values());
}

function createKnowledgeTitle(content: string, fallbackTitle: string): string {
  const normalizedContent = normalizeDraftText(content);

  if (!normalizedContent) {
    return fallbackTitle;
  }

  return normalizedContent.length > 24
    ? `${normalizedContent.slice(0, 24)}...`
    : normalizedContent;
}

function stripKnowledgeSaveInstruction(prompt: string): string {
  const normalizedPrompt = prompt.trim();
  const [beforeInstruction] = normalizedPrompt.split(
    /你能把|能把|帮我把|请把|把这个|把这条|写到|写进|存到|保存到|加入|放到|记到|记进|记录到|记录进|记住/u
  );

  if (beforeInstruction?.trim()) {
    return beforeInstruction.replace(/[，,。；;：:\s]+$/u, "").trim();
  }

  return normalizedPrompt
    .replace(/^(请|帮我)?(记住|保存|写到|写进|存到|加入|放到|记到|记进|记录到|记录进)(这个|这条|这些|这个信息|这条信息)?[：:\s]*/u, "")
    .replace(/(到|进)?(我的|本地)?(个人信息|知识库|记忆)(里|中)?(去)?[。.!！\s]*$/u, "")
    .trim();
}

export function parseAiAssistantKnowledgeSaveRequest(
  prompt: string
): AiAssistantKnowledgeSaveRequest | null {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    return null;
  }

  const hasKnowledgeSaveIntent =
    /(写到|写进|存到|保存到|加入|放到|记到|记进|记录到|记录进).*(知识库|本地知识|记忆|个人信息)/u.test(
      normalizedPrompt
    ) ||
    /(记住|保存|记录).*(这个|这条|这些|个人信息|知识库|记忆)/u.test(normalizedPrompt);

  if (!hasKnowledgeSaveIntent) {
    return null;
  }

  const content = stripKnowledgeSaveInstruction(normalizedPrompt);

  if (!content) {
    return null;
  }

  const isPersonalInfo = /个人信息|我的|我|体重|生日|年龄|身高|宠物/u.test(normalizedPrompt);

  return {
    title: isPersonalInfo ? "个人信息" : createKnowledgeTitle(content, "本地知识"),
    content,
    tags: isPersonalInfo ? "个人信息" : ""
  };
}

export function isAiAssistantKnowledgeSaveConfirmation(prompt: string): boolean {
  return /^(确认|确定|可以|好|好的|保存|写入|记住|对|没问题)[。.!！\s]*$/u.test(
    prompt.trim()
  );
}

export function isAiAssistantKnowledgeSaveCancellation(prompt: string): boolean {
  return /^(取消|不用|不要|先不|算了|放弃)[。.!！\s]*$/u.test(prompt.trim());
}

function createKnowledgeItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `knowledge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createKnowledgeChunks(content: string): string[] {
  const normalizedContent = normalizeDraftText(content);

  if (normalizedContent.length <= KNOWLEDGE_CHUNK_LENGTH) {
    return normalizedContent ? [normalizedContent] : [];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < normalizedContent.length) {
    chunks.push(normalizedContent.slice(startIndex, startIndex + KNOWLEDGE_CHUNK_LENGTH));
    startIndex += KNOWLEDGE_CHUNK_LENGTH - KNOWLEDGE_CHUNK_OVERLAP;
  }

  return chunks;
}

export function tokenizeAiAssistantKnowledgeText(value: string): string[] {
  const normalizedValue = value.toLowerCase();
  const latinTokens = normalizedValue.match(/[a-z0-9_\-]+/g) ?? [];
  const chineseSegments = normalizedValue.match(/[\u3400-\u9fff]+/g) ?? [];
  const chineseTokens = chineseSegments.flatMap((segment) => {
    const importantSingleTokens = Array.from(segment).filter((character) =>
      KNOWLEDGE_IMPORTANT_SINGLE_TOKENS.has(character)
    );

    if (segment.length <= 2) {
      return [segment, ...importantSingleTokens];
    }

    const bigrams: string[] = [];

    for (let index = 0; index < segment.length - 1; index += 1) {
      bigrams.push(segment.slice(index, index + 2));
    }

    return [...bigrams, ...importantSingleTokens];
  });

  return Array.from(new Set([...latinTokens, ...chineseTokens])).filter(
    (token) =>
      (token.length > 1 || KNOWLEDGE_IMPORTANT_SINGLE_TOKENS.has(token)) &&
      !KNOWLEDGE_STOP_TOKENS.has(token)
  );
}

function expandAiAssistantKnowledgeQueryTokens(query: string, tokens: readonly string[]): string[] {
  const expandedTokens = new Set(tokens);
  const normalizedQuery = query.toLowerCase();

  if (
    /javascript|typescript|\bjs\b|\bts\b|前端|网页|web|代码|编程|开发/.test(
      normalizedQuery
    )
  ) {
    ["前端", "开发", "工程师", "程序员", "web", "javascript", "typescript"].forEach(
      (token) => expandedTokens.add(token)
    );
  }

  if (/毕业|本科|大学|学历|入行|从业|工作.*多久|工作.*几年|几年|多少年/.test(query)) {
    ["从业", "工作", "年", "前端", "开发", "工程师", "毕业", "本科"].forEach((token) =>
      expandedTokens.add(token)
    );
  }

  return Array.from(expandedTokens);
}

function scoreKnowledgeChunk(queryTokens: string[], item: AiAssistantKnowledgeItem, chunk: string): number {
  const searchText = `${item.title} ${item.tags} ${chunk}`.toLowerCase();

  return queryTokens.reduce((score, token) => {
    if (!searchText.includes(token)) {
      return score;
    }

    const titleBoost = item.title.toLowerCase().includes(token) ? 2 : 0;
    const tagBoost = item.tags.toLowerCase().includes(token) ? 2 : 0;

    return score + 1 + titleBoost + tagBoost;
  }, 0);
}

export function searchAiAssistantKnowledgeItems(
  items: readonly AiAssistantKnowledgeItem[],
  query: string
): AiAssistantKnowledgeSnippet[] {
  const queryTokens = expandAiAssistantKnowledgeQueryTokens(
    query,
    tokenizeAiAssistantKnowledgeText(query)
  );

  if (queryTokens.length === 0) {
    return [];
  }

  return items
    .flatMap((item) =>
      createKnowledgeChunks(item.content).map((chunk) => ({
        itemId: item.id,
        title: item.title,
        tags: item.tags,
        content: chunk,
        score: scoreKnowledgeChunk(queryTokens, item, chunk)
      }))
    )
    .filter((snippet) => snippet.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_KNOWLEDGE_SNIPPETS);
}

export function shouldUseAiAssistantKnowledge(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  return !/^(翻译|translate|translation)[：:\s]/i.test(normalizedQuery);
}

export function isAiAssistantKnowledgeSensitiveQuestion(query: string): boolean {
  return (
    /我|我的|你知道|记得|本地知识|知识库/.test(query) ||
    /宠物|猫|狗|薯条|怂怂/.test(query)
  );
}

export function createAiAssistantKnowledgePrompt(
  userPrompt: string,
  basePrompt: string,
  snippets: readonly AiAssistantKnowledgeSnippet[]
): string {
  if (snippets.length === 0) {
    return basePrompt;
  }

  return [
    "以下内容是内部证据，只能用于生成答案，最终回答不能提到这些证据的来源、编号或检索过程。",
    "如果内部证据与问题无关，请忽略；如果内部证据信息不足，请用自然口吻说明不知道，不要编造。",
    "内部证据中的「我」「我的」指用户本人，不是助手；回答时必须用「你」「你的」转述用户事实。",
    "涉及用户宠物时，统一称为「你的宠物」，例如「你的宠物薯条是银渐层」。",
    "如果用户问某类对象的名字、有哪些或分别是什么，并且片段里列出多个对象，必须完整列出所有直接相关对象；不要只挑第一个。",
    "如果用户问某个具体事实是否成立，先判断内部证据是否直接支持；没有直接证据但可由通用常识或职业/身份常识合理推出时，可以用「大概率」「通常来说」「按常识判断」给出推断，并说明不是已记录事实；相近但不同的事实不能当作确定答案。",
    "职业技能可以做有边界的常识推断，例如「前端开发工程师」通常需要 JavaScript；但时间、年龄、毕业年份只能基于用户明确给出的数字和时间关系做算术，禁止自行补充未记录年龄、入学年份、学制、毕业年龄等信息。",
    "如果年龄来自本地知识库或用户明确表达，可以使用；但年龄只能作为已知事实或旁证，不能替代时间公式，也不能用年龄反推出未记录的入学/毕业年龄。",
    "如果用户明确说「本科毕业后就工作」且资料里有「从业 N 年」，毕业年份只能按「当前年份 - N」粗略估算，并说明这是估算；例如当前年份 2026、从业 10 年，则约为 2016 年，而不是 2023 年。如果没有明确时间关系，只能说明缺少信息，不能硬算。",
    "最终回答禁止出现这些措辞：根据片段、片段 1、片段1、根据知识库、知识库显示、资料显示、上下文提到、内部证据。",
    "最终回答要像朋友之间正常对话，直接回答，不要解释检索或推理过程。",
    "",
    snippets
      .map((snippet, index) =>
        [
          `片段 ${index + 1}：${snippet.title}`,
          snippet.tags ? `标签：${snippet.tags}` : "",
          snippet.content
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n"),
    "",
    "用户原始问题：",
    userPrompt,
    "",
    "当前请求：",
    basePrompt
  ].join("\n");
}

export function createAiAssistantKnowledgeMissingPrompt(
  userPrompt: string,
  basePrompt: string
): string {
  return [
    "本地知识库没有检索到能直接支持当前问题的片段。",
    "如果用户在问自己的个人信息或宠物信息，按三档回答：有直接证据时明确回答；没有直接证据但可由通用常识或职业/身份常识合理推出时，可以用「大概率」「通常来说」「按常识判断」给出推断，并说明不是已记录事实；既没有直接证据也不能可靠推断时，用自然口吻回答：我不知道呀，我这里没有这方面的信息。",
    "职业技能可以做有边界的常识推断，例如「前端开发工程师」通常需要 JavaScript；但时间、年龄、毕业年份只能基于用户明确给出的数字和时间关系做算术，禁止自行补充未记录年龄、入学年份、学制、毕业年龄等信息。",
    "如果年龄来自本地知识库或用户明确表达，可以使用；但年龄只能作为已知事实或旁证，不能替代时间公式，也不能用年龄反推出未记录的入学/毕业年龄。",
    "如果用户明确说「本科毕业后就工作」且资料里有「从业 N 年」，毕业年份只能按「当前年份 - N」粗略估算，并说明这是估算；例如当前年份 2026、从业 10 年，则约为 2016 年，而不是 2023 年。如果没有明确时间关系，只能说明缺少信息，不能硬算。",
    "不要把最近对话里的助手旧回答当作事实依据；只有用户明确说过或本地知识库直接支持的信息才算事实。",
    "如果用户问某个事实是否成立，不要把相近事实当作确定答案；只能把通用常识推断表述为概率性判断。",
    "最终回答禁止出现这些措辞：根据片段、片段 1、片段1、根据知识库、知识库显示、资料显示、上下文提到、内部证据。",
    "最终回答要像朋友之间正常对话，直接回答，不要解释检索或推理过程。",
    "",
    "用户原始问题：",
    userPrompt,
    "",
    "当前请求：",
    basePrompt
  ].join("\n");
}

export async function getAiAssistantKnowledgeItems(): Promise<AiAssistantKnowledgeItem[]> {
  if (!hasIndexedDb()) {
    return [];
  }

  const database = await openDatabase();

  try {
    const transaction = database.transaction(KNOWLEDGE_STORE_NAME, "readonly");
    const items = await requestToPromise<AiAssistantKnowledgeItem[]>(
      transaction.objectStore(KNOWLEDGE_STORE_NAME).getAll()
    );

    return normalizeKnowledgeItems(items);
  } finally {
    database.close();
  }
}

export async function saveAiAssistantKnowledgeItem(
  draft: AiAssistantKnowledgeDraft,
  existingItem?: AiAssistantKnowledgeItem
): Promise<AiAssistantKnowledgeItem> {
  if (!hasIndexedDb()) {
    throw new Error("INDEXED_DB_UNAVAILABLE");
  }

  const now = new Date().toISOString();
  const draftItem: AiAssistantKnowledgeItem = {
    id: existingItem?.id ?? createKnowledgeItemId(),
    title: draft.title.trim(),
    content: draft.content.trim(),
    tags: draft.tags.trim(),
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now
  };

  const database = await openDatabase();

  try {
    const transaction = database.transaction(KNOWLEDGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(KNOWLEDGE_STORE_NAME);
    const titleKey = normalizeKnowledgeTitleKey(draftItem.title);
    const existingItems = normalizeRawKnowledgeItems(
      await requestToPromise<AiAssistantKnowledgeItem[]>(store.getAll())
    );
    const sameTitleItems = existingItems.filter(
      (item) =>
        normalizeKnowledgeTitleKey(item.title) === titleKey ||
        item.id === existingItem?.id
    );
    const mergedItem = sameTitleItems.reduce(
      (currentItem, sameTitleItem) => mergeKnowledgeItemValues(sameTitleItem, currentItem),
      draftItem
    );

    sameTitleItems
      .filter((item) => item.id !== mergedItem.id)
      .forEach((item) => {
        store.delete(item.id);
      });

    store.put(mergedItem);
    await transactionToPromise(transaction);
    return mergedItem;
  } finally {
    database.close();
  }
}

export async function deleteAiAssistantKnowledgeItem(itemId: string): Promise<void> {
  if (!hasIndexedDb()) {
    return;
  }

  const database = await openDatabase();

  try {
    const transaction = database.transaction(KNOWLEDGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(KNOWLEDGE_STORE_NAME);
    const items = normalizeRawKnowledgeItems(
      await requestToPromise<AiAssistantKnowledgeItem[]>(store.getAll())
    );
    const item = items.find((knowledgeItem) => knowledgeItem.id === itemId);

    if (!item) {
      store.delete(itemId);
    } else {
      const titleKey = normalizeKnowledgeTitleKey(item.title);
      items
        .filter((knowledgeItem) => normalizeKnowledgeTitleKey(knowledgeItem.title) === titleKey)
        .forEach((knowledgeItem) => {
          store.delete(knowledgeItem.id);
        });
    }

    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}

export async function searchAiAssistantKnowledge(
  query: string
): Promise<AiAssistantKnowledgeSnippet[]> {
  if (!shouldUseAiAssistantKnowledge(query)) {
    return [];
  }

  return searchAiAssistantKnowledgeItems(await getAiAssistantKnowledgeItems(), query);
}
