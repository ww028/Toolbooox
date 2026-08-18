import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  deleteTodoItem,
  getTodoItems,
  saveTodoItem,
  updateTodoCompleted
} from "./storage";

const databaseName = "toolbooox.todos";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readRawItems(): Promise<Array<Record<string, unknown>>> {
  const database = await requestToPromise(indexedDB.open(databaseName, 1));
  const transaction = database.transaction("items", "readonly");
  const items = await requestToPromise<Array<Record<string, unknown>>>(
    transaction.objectStore("items").getAll()
  );
  database.close();

  return items;
}

describe("todo storage", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "todo-id")
    });
    await requestToPromise(indexedDB.deleteDatabase(databaseName));
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
    expect(await readRawItems()).toHaveLength(1);
  });

  it("updates completion state", async () => {
    const created = await saveTodoItem([], {
      title: "Ship",
      content: "Build package"
    }, null);
    const updated = await updateTodoCompleted(created, created[0].id, true);

    expect(updated[0].completed).toBe(true);
    expect(await getTodoItems()).toEqual(updated);
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
    expect(await readRawItems()).toEqual([]);
  });

});
