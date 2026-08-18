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

const TODO_STORAGE_KEY = "toolbooox.todos.items";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
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

async function saveTodoItems(items: readonly TodoItem[]): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [TODO_STORAGE_KEY]: items });
    return;
  }

  window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(items));
}

export async function getTodoItems(): Promise<TodoItem[]> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(TODO_STORAGE_KEY);
    return normalizeTodoItems(result[TODO_STORAGE_KEY]);
  }

  const rawItems = window.localStorage.getItem(TODO_STORAGE_KEY);

  if (!rawItems) {
    return [];
  }

  try {
    return normalizeTodoItems(JSON.parse(rawItems));
  } catch {
    return [];
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
