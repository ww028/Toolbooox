export type TodoItem = {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TodoDraft = {
  readonly title: string;
  readonly content: string;
};

const DATABASE_NAME = "toolbooox.todos";
const DATABASE_VERSION = 1;
const ITEM_STORE_NAME = "items";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<TodoItem>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    typeof item.completed === "boolean" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function normalizeTodoItems(value: unknown): TodoItem[] {
  return Array.isArray(value)
    ? value.filter(isTodoItem).map((item) => ({
        ...item,
        title: item.title.trim(),
        content: item.content.trim()
      }))
    : [];
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

      if (!database.objectStoreNames.contains(ITEM_STORE_NAME)) {
        const itemStore = database.createObjectStore(ITEM_STORE_NAME, {
          keyPath: "id"
        });
        itemStore.createIndex("completed", "completed", { unique: false });
        itemStore.createIndex("createdAt", "createdAt", { unique: false });
        itemStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readIndexedDbTodoItems(database: IDBDatabase): Promise<TodoItem[]> {
  const transaction = database.transaction(ITEM_STORE_NAME, "readonly");
  const items = await requestToPromise<TodoItem[]>(
    transaction.objectStore(ITEM_STORE_NAME).getAll()
  );

  return normalizeTodoItems(items).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

async function replaceIndexedDbTodoItems(
  database: IDBDatabase,
  items: readonly TodoItem[]
): Promise<void> {
  const transaction = database.transaction(ITEM_STORE_NAME, "readwrite");
  const itemStore = transaction.objectStore(ITEM_STORE_NAME);
  itemStore.clear();

  normalizeTodoItems(items).forEach((item) => {
    itemStore.put(item);
  });

  await transactionToPromise(transaction);
}

async function saveTodoItems(items: readonly TodoItem[]): Promise<void> {
  if (!hasIndexedDb()) {
    throw new Error("INDEXED_DB_UNAVAILABLE");
  }

  const database = await openDatabase();

  try {
    await replaceIndexedDbTodoItems(database, items);
  } finally {
    database.close();
  }
}

export async function getTodoItems(): Promise<TodoItem[]> {
  if (!hasIndexedDb()) {
    return [];
  }

  const database = await openDatabase();

  try {
    return await readIndexedDbTodoItems(database);
  } finally {
    database.close();
  }
}

export async function saveTodoItem(
  items: readonly TodoItem[],
  draft: TodoDraft,
  editingId: string | null
): Promise<TodoItem[]> {
  const now = new Date().toISOString();
  const normalizedDraft = {
    title: draft.title.trim(),
    content: draft.content.trim()
  };

  const existingItem = editingId ? items.find((item) => item.id === editingId) : undefined;
  const nextItem: TodoItem = {
    id: existingItem?.id ?? crypto.randomUUID(),
    title: normalizedDraft.title,
    content: normalizedDraft.content,
    completed: existingItem?.completed ?? false,
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now
  };
  const nextItems = existingItem
    ? items.map((item) => (item.id === existingItem.id ? nextItem : item))
    : [nextItem, ...items];

  await saveTodoItems(nextItems);
  return nextItems;
}

export async function updateTodoCompleted(
  items: readonly TodoItem[],
  todoId: string,
  completed: boolean
): Promise<TodoItem[]> {
  const now = new Date().toISOString();
  const nextItems = items.map((item) =>
    item.id === todoId
      ? {
          ...item,
          completed,
          updatedAt: now
        }
      : item
  );

  await saveTodoItems(nextItems);
  return nextItems;
}

export async function deleteTodoItem(
  items: readonly TodoItem[],
  todoId: string
): Promise<TodoItem[]> {
  const nextItems = items.filter((item) => item.id !== todoId);

  await saveTodoItems(nextItems);
  return nextItems;
}
