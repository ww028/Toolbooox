import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  getAiAssistantConversations,
  saveAiAssistantInitialized,
  saveAiAssistantConversations,
  type AiAssistantConversation
} from "./storage";

const databaseName = "toolbooox.aiAssistant";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readRawConversations(): Promise<Array<Record<string, unknown>>> {
  const database = await requestToPromise(indexedDB.open(databaseName, 1));
  const transaction = database.transaction("conversations", "readonly");
  const conversations = await requestToPromise<Array<Record<string, unknown>>>(
    transaction.objectStore("conversations").getAll()
  );
  database.close();

  return conversations;
}

function createConversation(id: string, title: string): AiAssistantConversation {
  return {
    id,
    title,
    messages: [
      {
        id: `${id}-message`,
        role: "user",
        content: title
      }
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("ai assistant storage", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    await requestToPromise(indexedDB.deleteDatabase(databaseName));
  });

  it("stores conversations in IndexedDB", async () => {
    const conversations = await saveAiAssistantConversations([
      createConversation("conversation-1", "First")
    ]);

    expect(conversations).toHaveLength(1);
    expect(await getAiAssistantConversations()).toEqual(conversations);
    expect(await readRawConversations()).toHaveLength(1);
  });

  it("ignores initialization hint persistence when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(saveAiAssistantInitialized(false)).resolves.toBeUndefined();
  });

});
