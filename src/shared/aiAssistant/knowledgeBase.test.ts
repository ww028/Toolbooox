import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  createAiAssistantKnowledgeMissingPrompt,
  createAiAssistantKnowledgePrompt,
  deleteAiAssistantKnowledgeItem,
  getAiAssistantKnowledgeItems,
  isAiAssistantKnowledgeSensitiveQuestion,
  isAiAssistantKnowledgeSaveCancellation,
  isAiAssistantKnowledgeSaveConfirmation,
  parseAiAssistantKnowledgeSaveRequest,
  saveAiAssistantKnowledgeItem,
  searchAiAssistantKnowledge,
  searchAiAssistantKnowledgeItems,
  shouldUseAiAssistantKnowledge,
  tokenizeAiAssistantKnowledgeText
} from "./knowledgeBase";

const databaseName = "toolbooox.aiAssistantKnowledge";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

describe("ai assistant knowledge base", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    await requestToPromise(indexedDB.deleteDatabase(databaseName));
  });

  it("stores and deletes knowledge items in IndexedDB", async () => {
    const item = await saveAiAssistantKnowledgeItem({
      title: "试单流程",
      content: "试单需要先创建 trial order，然后校验支付状态。",
      tags: "订单, 流程"
    });

    await expect(getAiAssistantKnowledgeItems()).resolves.toEqual([item]);

    await deleteAiAssistantKnowledgeItem(item.id);

    await expect(getAiAssistantKnowledgeItems()).resolves.toEqual([]);
  });

  it("merges knowledge items with the same title", async () => {
    const firstItem = await saveAiAssistantKnowledgeItem({
      title: "个人信息",
      content: "我的体重是160斤。",
      tags: "个人信息"
    });
    const secondItem = await saveAiAssistantKnowledgeItem({
      title: "个人信息",
      content: "我的身高是172cm。",
      tags: "身体信息"
    });

    const [item] = await getAiAssistantKnowledgeItems();

    expect(secondItem.id).toBe(firstItem.id);
    expect(await getAiAssistantKnowledgeItems()).toHaveLength(1);
    expect(item?.title).toBe("个人信息");
    expect(item?.content).toContain("我的体重是160斤。");
    expect(item?.content).toContain("我的身高是172cm。");
    expect(item?.tags).toBe("个人信息, 身体信息");
  });

  it("does not append duplicate content when saving the same knowledge again", async () => {
    await saveAiAssistantKnowledgeItem({
      title: "宠物",
      content: "我的宠物薯条是银渐层。",
      tags: "宠物"
    });
    await saveAiAssistantKnowledgeItem({
      title: "宠物",
      content: "我的宠物薯条是银渐层。",
      tags: "宠物"
    });

    const [item] = await getAiAssistantKnowledgeItems();

    expect(await getAiAssistantKnowledgeItems()).toHaveLength(1);
    expect(item?.content).toBe("我的宠物薯条是银渐层。");
  });

  it("parses conversation requests that save personal info to the knowledge base", () => {
    expect(
      parseAiAssistantKnowledgeSaveRequest(
        "今天是2026年7月19日，我的体重是160斤，你能把这个写到只是知识库里去吗？这是我的个人信息"
      )
    ).toEqual({
      title: "个人信息",
      content: "今天是2026年7月19日，我的体重是160斤",
      tags: "个人信息"
    });

    expect(
      parseAiAssistantKnowledgeSaveRequest(
        "我的身高是172cm，把这个信息也记录到我的个人信息里去"
      )
    ).toEqual({
      title: "个人信息",
      content: "我的身高是172cm",
      tags: "个人信息"
    });

    expect(parseAiAssistantKnowledgeSaveRequest("我的猫叫啥名字？")).toBeNull();
  });

  it("detects save confirmation and cancellation replies", () => {
    expect(isAiAssistantKnowledgeSaveConfirmation("确认")).toBe(true);
    expect(isAiAssistantKnowledgeSaveConfirmation("保存")).toBe(true);
    expect(isAiAssistantKnowledgeSaveCancellation("取消")).toBe(true);
    expect(isAiAssistantKnowledgeSaveCancellation("不用")).toBe(true);
    expect(isAiAssistantKnowledgeSaveConfirmation("我的体重是多少？")).toBe(false);
  });

  it("searches relevant chunks by keyword score", () => {
    const snippets = searchAiAssistantKnowledgeItems(
      [
        {
          id: "item-1",
          title: "订单流程",
          content: "试单需要先创建 trial order，然后校验支付状态。",
          tags: "订单",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        },
        {
          id: "item-2",
          title: "密码说明",
          content: "密码库只保存在本地。",
          tags: "安全",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      "试单怎么处理"
    );

    expect(snippets[0]?.itemId).toBe("item-1");
    expect(snippets[0]?.content).toContain("trial order");
  });

  it("expands professional skill queries to match related profile knowledge", () => {
    const snippets = searchAiAssistantKnowledgeItems(
      [
        {
          id: "item-1",
          title: "个人信息",
          content: "我是一名前端开发工程师，从业 10 年。",
          tags: "个人信息",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      "我会写JavaScript吗？"
    );

    expect(snippets[0]?.itemId).toBe("item-1");
  });

  it("expands career timeline questions to match work experience knowledge", () => {
    const snippets = searchAiAssistantKnowledgeItems(
      [
        {
          id: "item-1",
          title: "个人信息",
          content: "我是一名前端开发工程师，从业 10 年。",
          tags: "个人信息",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      "你推算一下我大概什么时候本科毕业的"
    );

    expect(snippets[0]?.itemId).toBe("item-1");
  });

  it("does not match adjacent pet facts when the specific entity is absent", () => {
    const snippets = searchAiAssistantKnowledgeItems(
      [
        {
          id: "item-1",
          title: "宠物信息",
          content: "我养了两只猫，一只叫薯条，一只叫怂怂。薯条是银渐层，怂怂是三花猫。",
          tags: "宠物",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      "我养狗了吗？"
    );

    expect(snippets).toEqual([]);
  });

  it("matches category questions that ask for all cat names", () => {
    const snippets = searchAiAssistantKnowledgeItems(
      [
        {
          id: "item-1",
          title: "宠物信息",
          content: "我养了两只猫，一只叫薯条，一只叫怂怂。薯条是银渐层，怂怂是三花猫。",
          tags: "宠物",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      "我的猫叫啥名字？"
    );

    expect(snippets[0]?.content).toContain("薯条");
    expect(snippets[0]?.content).toContain("怂怂");
  });

  it("wraps prompt with knowledge snippets", () => {
    const prompt = createAiAssistantKnowledgePrompt("试单是什么", "试单是什么", [
      {
        itemId: "item-1",
        title: "订单流程",
        tags: "订单",
        content: "试单可翻译为 trial order。",
        score: 3
      }
    ]);

    expect(prompt).toContain("以下内容是内部证据");
    expect(prompt).toContain("「我」「我的」指用户本人");
    expect(prompt).toContain("用「你」「你的」转述用户事实");
    expect(prompt).toContain("涉及用户宠物时，统一称为「你的宠物」");
    expect(prompt).toContain("你的宠物薯条是银渐层");
    expect(prompt).toContain("完整列出所有直接相关对象");
    expect(prompt).toContain("通用常识或职业/身份常识合理推出");
    expect(prompt).toContain("不是已记录事实");
    expect(prompt).toContain("相近但不同的事实不能当作确定答案");
    expect(prompt).toContain("禁止自行补充未记录年龄");
    expect(prompt).toContain("年龄来自本地知识库或用户明确表达，可以使用");
    expect(prompt).toContain("不能替代时间公式");
    expect(prompt).toContain("当前年份 - N");
    expect(prompt).toContain("最终回答禁止出现这些措辞");
    expect(prompt).toContain("像朋友之间正常对话");
    expect(prompt).toContain("试单可翻译为 trial order");
    expect(prompt).toContain("用户原始问题：\n试单是什么");
  });

  it("creates a missing-evidence prompt for sensitive personal questions", () => {
    const prompt = createAiAssistantKnowledgeMissingPrompt("我养狗了吗？", "我养狗了吗？");

    expect(isAiAssistantKnowledgeSensitiveQuestion("我养狗了吗？")).toBe(true);
    expect(prompt).toContain("没有检索到能直接支持当前问题的片段");
    expect(prompt).toContain("按三档回答");
    expect(prompt).toContain("通用常识或职业/身份常识合理推出");
    expect(prompt).toContain("禁止自行补充未记录年龄");
    expect(prompt).toContain("年龄来自本地知识库或用户明确表达，可以使用");
    expect(prompt).toContain("不能硬算");
    expect(prompt).toContain("我不知道呀，我这里没有这方面的信息");
    expect(prompt).toContain("不要把最近对话里的助手旧回答当作事实依据");
    expect(prompt).toContain("概率性判断");
    expect(prompt).toContain("最终回答禁止出现这些措辞");
  });

  it("skips knowledge search for translation tasks", async () => {
    expect(shouldUseAiAssistantKnowledge("翻译：hello")).toBe(false);
    expect(shouldUseAiAssistantKnowledge("translate: hello")).toBe(false);
    expect(tokenizeAiAssistantKnowledgeText("试单 trial order")).toContain("试单");
    await expect(searchAiAssistantKnowledge("翻译：hello")).resolves.toEqual([]);
  });
});
