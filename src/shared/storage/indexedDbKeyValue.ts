const DATABASE_NAME = "toolbooox.keyValue";
const DATABASE_VERSION = 1;
const VALUE_STORE_NAME = "values";

type StoredValueRecord = {
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: string;
};

export function hasIndexedDb(): boolean {
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

      if (!database.objectStoreNames.contains(VALUE_STORE_NAME)) {
        database.createObjectStore(VALUE_STORE_NAME, {
          keyPath: "key"
        });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

export async function getIndexedDbValue(key: string): Promise<unknown> {
  if (!hasIndexedDb()) {
    return undefined;
  }

  const database = await openDatabase();

  try {
    const transaction = database.transaction(VALUE_STORE_NAME, "readonly");
    const record = await requestToPromise<StoredValueRecord | undefined>(
      transaction.objectStore(VALUE_STORE_NAME).get(key)
    );
    return record?.value;
  } finally {
    database.close();
  }
}

export async function setIndexedDbValue(key: string, value: unknown): Promise<void> {
  if (!hasIndexedDb()) {
    throw new Error("INDEXED_DB_UNAVAILABLE");
  }

  const database = await openDatabase();

  try {
    const transaction = database.transaction(VALUE_STORE_NAME, "readwrite");
    transaction.objectStore(VALUE_STORE_NAME).put({
      key,
      value,
      updatedAt: new Date().toISOString()
    });
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}
