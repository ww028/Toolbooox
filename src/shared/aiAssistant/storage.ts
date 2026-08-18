import {
  getIndexedDbValue,
  hasIndexedDb as hasKeyValueIndexedDb,
  setIndexedDbValue
} from "../storage/indexedDbKeyValue";

const AI_ASSISTANT_INITIALIZED_STORAGE_KEY = "toolbooox.aiAssistant.initialized";
const DATABASE_NAME = "toolbooox.aiAssistant";
const DATABASE_VERSION = 1;
const CONVERSATION_STORE_NAME = "conversations";
const MAX_AI_ASSISTANT_CONVERSATIONS = 30;

export type AiAssistantStoredMessage = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
};

export type AiAssistantConversation = {
  readonly id: string;
  readonly title: string;
  readonly messages: AiAssistantStoredMessage[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function getSavedAiAssistantInitialized(): Promise<boolean> {
  if (hasKeyValueIndexedDb()) {
    return (await getIndexedDbValue(AI_ASSISTANT_INITIALIZED_STORAGE_KEY)) === true;
  }

  return false;
}

export async function saveAiAssistantInitialized(isInitialized: boolean): Promise<void> {
  if (hasKeyValueIndexedDb()) {
    await setIndexedDbValue(AI_ASSISTANT_INITIALIZED_STORAGE_KEY, isInitialized);
    return;
  }

  await setIndexedDbValue(AI_ASSISTANT_INITIALIZED_STORAGE_KEY, isInitialized);
}

function isStoredMessage(value: unknown): value is AiAssistantStoredMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<AiAssistantStoredMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function normalizeConversation(value: unknown): AiAssistantConversation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const conversation = value as Partial<AiAssistantConversation>;

  if (
    typeof conversation.id !== "string" ||
    typeof conversation.title !== "string" ||
    typeof conversation.createdAt !== "string" ||
    typeof conversation.updatedAt !== "string" ||
    !Array.isArray(conversation.messages)
  ) {
    return null;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.filter(isStoredMessage),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

function normalizeConversations(value: unknown): AiAssistantConversation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeConversation)
    .filter((conversation): conversation is AiAssistantConversation => conversation !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_AI_ASSISTANT_CONVERSATIONS);
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

      if (!database.objectStoreNames.contains(CONVERSATION_STORE_NAME)) {
        const conversationStore = database.createObjectStore(CONVERSATION_STORE_NAME, {
          keyPath: "id"
        });
        conversationStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readIndexedDbConversations(
  database: IDBDatabase
): Promise<AiAssistantConversation[]> {
  const transaction = database.transaction(CONVERSATION_STORE_NAME, "readonly");
  const conversations = await requestToPromise<AiAssistantConversation[]>(
    transaction.objectStore(CONVERSATION_STORE_NAME).getAll()
  );

  return normalizeConversations(conversations);
}

async function replaceIndexedDbConversations(
  database: IDBDatabase,
  conversations: AiAssistantConversation[]
): Promise<void> {
  const transaction = database.transaction(CONVERSATION_STORE_NAME, "readwrite");
  const conversationStore = transaction.objectStore(CONVERSATION_STORE_NAME);
  conversationStore.clear();

  normalizeConversations(conversations).forEach((conversation) => {
    conversationStore.put(conversation);
  });

  await transactionToPromise(transaction);
}

export async function getAiAssistantConversations(): Promise<AiAssistantConversation[]> {
  if (!hasIndexedDb()) {
    return [];
  }

  const database = await openDatabase();

  try {
    return await readIndexedDbConversations(database);
  } finally {
    database.close();
  }
}

export async function saveAiAssistantConversations(
  conversations: AiAssistantConversation[]
): Promise<AiAssistantConversation[]> {
  const normalizedConversations = normalizeConversations(conversations);

  if (!hasIndexedDb()) {
    throw new Error("INDEXED_DB_UNAVAILABLE");
  }

  const database = await openDatabase();

  try {
    await replaceIndexedDbConversations(database, normalizedConversations);
    return normalizedConversations;
  } finally {
    database.close();
  }
}
