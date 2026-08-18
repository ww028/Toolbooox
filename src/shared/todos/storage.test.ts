import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteTodoItem,
  getTodoItems,
  saveTodoItem,
  updateTodoCompleted
} from "./storage";

const storageKey = "toolbooox.todos.items";

type StoredValue = Record<string, unknown>;

function createChromeMock(storage: StoredValue) {
  return {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]: storage[key]
        })),
        set: vi.fn(async (value: StoredValue) => {
          Object.assign(storage, value);
        })
      }
    }
  };
}

describe("todo storage", () => {
  let chromeStorage: StoredValue;

  beforeEach(() => {
    vi.restoreAllMocks();
    chromeStorage = {};
    vi.stubGlobal("chrome", createChromeMock(chromeStorage));
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "todo-id")
    });
  });

  it("creates todo items locally", async () => {
    const items = await saveTodoItem([], {
      title: "  Read docs  ",
      content: "  Finish the extension notes  "
    }, null);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "todo-id",
      title: "Read docs",
      content: "Finish the extension notes",
      completed: false
    });
    expect(chromeStorage[storageKey]).toEqual(items);
  });

  it("updates completion state", async () => {
    const created = await saveTodoItem([], {
      title: "Ship",
      content: "Build package"
    }, null);
    const updated = await updateTodoCompleted(created, created[0].id, true);

    expect(updated[0].completed).toBe(true);
    expect(chromeStorage[storageKey]).toEqual(updated);
  });

  it("updates and deletes existing todo items", async () => {
    const created = await saveTodoItem([], {
      title: "Old",
      content: "Old content"
    }, null);
    const updated = await saveTodoItem(created, {
      title: "New",
      content: "New content"
    }, created[0].id);

    expect(updated[0]).toMatchObject({
      id: created[0].id,
      title: "New",
      content: "New content"
    });
    expect(await getTodoItems()).toEqual(updated);

    const deleted = await deleteTodoItem(updated, created[0].id);

    expect(deleted).toEqual([]);
    expect(chromeStorage[storageKey]).toEqual([]);
  });
});
