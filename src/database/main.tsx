import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../shared/styles/scrollbars.css";
import "./styles.css";

type DatabaseStoreSnapshot = {
  readonly name: string;
  readonly records: unknown[];
  readonly error?: string;
};

type DatabaseSnapshot = {
  readonly name: string;
  readonly version?: number;
  readonly stores: DatabaseStoreSnapshot[];
  readonly error?: string;
};

type StoreMenuItem = {
  readonly key: string;
  readonly databaseName: string;
  readonly databaseVersion?: number;
  readonly store: DatabaseStoreSnapshot;
};

const STORE_DISPLAY_NAMES: Record<string, string> = {
  "toolbooox.addressNavigation::items": "地址导航",
  "toolbooox.aiAssistant::conversations": "AI 助手会话",
  "toolbooox.aiAssistantKnowledge::knowledgeItems": "AI 助手本地知识库",
  "toolbooox.keyValue::values": "通用设置",
  "toolbooox.passwordVault::passwordEntries": "密码库",
  "toolbooox.todos::items": "待办事项"
};

const FIELD_LABELS: Record<string, string> = {
  completed: "完成状态",
  content: "内容",
  createdAt: "创建时间",
  displayName: "显示名称",
  encryptionVersion: "加密版本",
  hostname: "域名",
  id: "ID",
  iv: "初始化向量",
  key: "键",
  localDomain: "本地域名",
  messages: "消息",
  onlineDomain: "线上域名",
  password: "密码",
  passwordEncoding: "密码编码",
  remark: "备注",
  schemaVersion: "结构版本",
  sortOrder: "排序",
  summary: "摘要",
  tags: "标签",
  title: "标题",
  updatedAt: "更新时间",
  url: "地址",
  username: "用户名",
  value: "值"
};
const DATABASE_PAGE_SIZE = 10;
type PaginationItem = number | "ellipsis";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function openIndexedDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => {
      reject(new Error("DATABASE_OPEN_BLOCKED"));
    });
  });
}

function createStoreKey(databaseName: string, storeName: string): string {
  return `${databaseName}::${storeName}`;
}

function getStoreDisplayName(item: StoreMenuItem): string {
  return STORE_DISPLAY_NAMES[item.key] ?? item.store.name;
}

function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  return String(value);
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatDateTimeValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`
  ].join(" ");
}

function isDateTimeField(fieldName: string): boolean {
  return /(^|A)t$/u.test(fieldName) || fieldName.endsWith("At");
}

function createPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_item, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

function createRecordColumns(records: readonly unknown[]): string[] {
  const columns: string[] = [];
  const ignoredColumns = new Set(["id"]);

  records.forEach((record) => {
    getRecordEntries(record).forEach(([fieldName]) => {
      if (!ignoredColumns.has(fieldName) && !columns.includes(fieldName)) {
        columns.push(fieldName);
      }
    });
  });

  return columns.slice(0, 8);
}

function getRecordValue(record: unknown, fieldName: string): unknown {
  if (!isPlainRecord(record)) {
    return fieldName === "value" ? record : undefined;
  }

  return record[fieldName];
}

function formatDisplayValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer（${value.byteLength} bytes）`;
  }

  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}（${value.byteLength} bytes）`;
  }

  if (Array.isArray(value)) {
    return `${value.length} 项`;
  }

  if (isPlainRecord(value)) {
    return `${Object.keys(value).length} 个字段`;
  }

  return formatPrimitiveValue(value);
}

function renderTableValue(value: unknown, fieldName: string) {
  const formattedDateTime = isDateTimeField(fieldName) ? formatDateTimeValue(value) : null;

  if (formattedDateTime) {
    return <span>{formattedDateTime}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="database-empty-value">空</span>;
    }

    const primitiveItems = value.every(
      (item) =>
        item === null ||
        ["string", "number", "boolean", "bigint", "undefined"].includes(typeof item)
    );

    if (primitiveItems) {
      return (
        <span className="database-tag-list">
          {value.slice(0, 6).map((item, index) => (
            <span className="database-tag" key={index}>
              {formatDisplayValue(item)}
            </span>
          ))}
          {value.length > 6 ? <span className="database-tag">+{value.length - 6}</span> : null}
        </span>
      );
    }

    return <span className="database-summary-value">{formatDisplayValue(value)}</span>;
  }

  if (isPlainRecord(value)) {
    return <span className="database-summary-value">{formatDisplayValue(value)}</span>;
  }

  if (typeof value === "undefined") {
    return <span className="database-empty-value">-</span>;
  }

  return <span>{formatDisplayValue(value)}</span>;
}

function getRecordEntries(record: unknown): [string, unknown][] {
  if (!isPlainRecord(record)) {
    return [["value", record]];
  }

  return Object.entries(record);
}

function getRecordTitle(record: unknown, index: number): string {
  if (!isPlainRecord(record)) {
    return `记录 ${index + 1}`;
  }

  const title =
    record.title ??
    record.displayName ??
    record.name ??
    record.key ??
    record.id ??
    `记录 ${index + 1}`;

  return String(title);
}

async function readStoreSnapshot(
  database: IDBDatabase,
  storeName: string
): Promise<DatabaseStoreSnapshot> {
  try {
    const transaction = database.transaction(storeName, "readonly");
    const records = await requestToPromise<unknown[]>(
      transaction.objectStore(storeName).getAll()
    );

    return {
      name: storeName,
      records
    };
  } catch (error) {
    return {
      name: storeName,
      records: [],
      error: error instanceof Error ? error.message : "读取失败"
    };
  }
}

async function readDatabaseSnapshot(
  databaseInfo: IDBDatabaseInfo
): Promise<DatabaseSnapshot> {
  const databaseName = databaseInfo.name;

  if (!databaseName) {
    return {
      name: "未命名数据库",
      stores: [],
      error: "数据库名称为空"
    };
  }

  let database: IDBDatabase | null = null;

  try {
    database = await openIndexedDatabase(databaseName);
    const storeNames = Array.from(database.objectStoreNames);
    const stores = await Promise.all(
      storeNames.map((storeName) => readStoreSnapshot(database as IDBDatabase, storeName))
    );

    return {
      name: databaseName,
      version: database.version,
      stores
    };
  } catch (error) {
    return {
      name: databaseName,
      version: databaseInfo.version,
      stores: [],
      error: error instanceof Error ? error.message : "数据库读取失败"
    };
  } finally {
    database?.close();
  }
}

async function readIndexedDbSnapshots(): Promise<DatabaseSnapshot[]> {
  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<IDBDatabaseInfo[]>;
  };

  if (!indexedDbWithDatabases.databases) {
    throw new Error("当前浏览器不支持 indexedDB.databases()。");
  }

  const databases = await indexedDbWithDatabases.databases();
  const toolboooxDatabases = databases
    .filter((database) => database.name?.startsWith("toolbooox."))
    .sort((left, right) => (left.name ?? "").localeCompare(right.name ?? ""));

  return Promise.all(toolboooxDatabases.map(readDatabaseSnapshot));
}

function DatabaseApp() {
  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>([]);
  const [selectedStoreKey, setSelectedStoreKey] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const storeMenuItems = useMemo<StoreMenuItem[]>(
    () =>
      snapshots.flatMap((database) =>
        database.stores.map((store) => ({
          key: createStoreKey(database.name, store.name),
          databaseName: database.name,
          databaseVersion: database.version,
          store
        }))
      ),
    [snapshots]
  );
  const selectedStore = useMemo(
    () => storeMenuItems.find((item) => item.key === selectedStoreKey) ?? storeMenuItems[0],
    [selectedStoreKey, storeMenuItems]
  );
  const selectedColumns = useMemo(
    () => createRecordColumns(selectedStore?.store.records ?? []),
    [selectedStore]
  );
  const selectedRecordCount = selectedStore?.store.records.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(selectedRecordCount / DATABASE_PAGE_SIZE));
  const paginationItems = useMemo(
    () => createPaginationItems(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const currentPageStartIndex = (currentPage - 1) * DATABASE_PAGE_SIZE;
  const currentPageRecords = selectedStore?.store.records.slice(
    currentPageStartIndex,
    currentPageStartIndex + DATABASE_PAGE_SIZE
  ) ?? [];

  const loadDatabases = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      setSnapshots(await readIndexedDbSnapshots());
    } catch (error) {
      setSnapshots([]);
      setErrorMessage(error instanceof Error ? error.message : "数据库读取失败。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDatabases();
  }, []);

  useEffect(() => {
    if (
      storeMenuItems.length > 0 &&
      !storeMenuItems.some((item) => item.key === selectedStoreKey)
    ) {
      setSelectedStoreKey(storeMenuItems[0].key);
    }
  }, [selectedStoreKey, storeMenuItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStoreKey]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <main className="database-shell">
      <header className="database-header">
        <div>
          <h1>数据库</h1>
          <p>当前扩展 IndexedDB 中保存的数据，只读展示。</p>
        </div>
        <button className="database-refresh-button" type="button" onClick={loadDatabases}>
          刷新
        </button>
      </header>

      {isLoading ? <p className="database-status">正在读取数据库...</p> : null}
      {errorMessage ? <p className="database-status database-status-error">{errorMessage}</p> : null}

      {!isLoading && !errorMessage && snapshots.length === 0 ? (
        <p className="database-status">暂无 Toolbooox IndexedDB 数据。</p>
      ) : null}

      {storeMenuItems.length > 0 ? (
        <section className="database-workspace" aria-label="IndexedDB 数据库数据">
          <aside className="database-sidebar" aria-label="数据库表">
            <div className="database-sidebar-header">
              <h2>数据表</h2>
              <span>{storeMenuItems.length}</span>
            </div>
            <div className="database-table-menu">
              {storeMenuItems.map((item) => (
                <button
                  aria-current={item.key === selectedStore?.key ? "page" : undefined}
                  className="database-table-menu-item"
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedStoreKey(item.key)}
                >
                  <strong>{getStoreDisplayName(item)}</strong>
                  <span>{item.databaseName}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="database-record-panel">
            {selectedStore ? (
              <>
                <header className="database-record-header">
                  <div>
                    <h2>{getStoreDisplayName(selectedStore)}</h2>
                    <p>
                      {selectedStore.databaseName} · 版本：
                      {selectedStore.databaseVersion ?? "未知"}
                    </p>
                  </div>
                  <strong>{selectedStore.store.records.length} 条记录</strong>
                </header>

                {selectedStore.store.error ? (
                  <p className="database-status database-status-error">
                    {selectedStore.store.error}
                  </p>
                ) : null}

                {!selectedStore.store.error && selectedStore.store.records.length === 0 ? (
                  <p className="database-status">当前表暂无数据。</p>
                ) : null}

                {selectedStore.store.records.length > 0 ? (
                  <div className="database-table-wrapper">
                    <table className="database-data-table">
                      <thead>
                        <tr>
                          <th>记录</th>
                          {selectedColumns.map((column) => (
                            <th key={column}>{getFieldLabel(column)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentPageRecords.map((record, index) => (
                          <tr key={index}>
                            <td className="database-record-title">
                              {getRecordTitle(record, currentPageStartIndex + index)}
                            </td>
                            {selectedColumns.map((column) => (
                              <td key={column}>
                                {renderTableValue(getRecordValue(record, column), column)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {selectedStore.store.records.length > 0 ? (
                  <footer className="database-pagination">
                    <span>共 {selectedRecordCount} 条</span>
                    <div className="database-pagination-actions">
                      <button
                        aria-label="上一页"
                        disabled={currentPage <= 1}
                        className="database-page-nav"
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      >
                        ‹
                      </button>
                      {paginationItems.map((item, index) =>
                        item === "ellipsis" ? (
                          <span className="database-page-ellipsis" key={`ellipsis-${index}`}>
                            ...
                          </span>
                        ) : (
                          <button
                            aria-current={item === currentPage ? "page" : undefined}
                            className="database-page-button"
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                          >
                            {item}
                          </button>
                        )
                      )}
                      <button
                        aria-label="下一页"
                        disabled={currentPage >= totalPages}
                        className="database-page-nav"
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      >
                        ›
                      </button>
                      <select aria-label="每页条数" value={DATABASE_PAGE_SIZE} disabled>
                        <option value={DATABASE_PAGE_SIZE}>{DATABASE_PAGE_SIZE} 条/页</option>
                      </select>
                    </div>
                  </footer>
                ) : null}
              </>
            ) : null}
          </section>
        </section>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <DatabaseApp />
  </StrictMode>
);
