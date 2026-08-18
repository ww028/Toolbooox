import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  evaluateCalculatorExpression,
  formatCalculatorChineseDescription,
  formatCalculatorResult,
  percentCurrentCalculatorNumber,
  toggleCurrentCalculatorNumberSign
} from "../shared/calculator/evaluate";
import {
  appendCalculatorHistoryItem,
  type CalculatorHistoryItem,
  getSavedCalculatorState,
  saveCalculatorState
} from "../shared/calculator/storage";
import { getDefaultLocale, getSavedLocale, type Locale } from "../shared/i18n/locale";
import { messages } from "../shared/i18n/messages";
import { isCloseSidePanelMessage } from "../shared/sidePanel/messages";
import {
  deleteTodoItem,
  getTodoItems,
  saveTodoItem,
  updateTodoCompleted,
  type TodoDraft,
  type TodoItem
} from "../shared/todos/storage";
import "./styles.css";

const emptyTodoDraft: TodoDraft = {
  title: "",
  content: ""
};
const ACTIVE_TOOL_STORAGE_KEY = "toolbooox.activeTool";
type SidePanelToolKey = "calculator" | "todoItems";

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function normalizeSidePanelToolKey(value: unknown): SidePanelToolKey {
  return value === "calculator" ? "calculator" : "todoItems";
}

async function getSavedSidePanelTool(): Promise<SidePanelToolKey> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(ACTIVE_TOOL_STORAGE_KEY);
    return normalizeSidePanelToolKey(result[ACTIVE_TOOL_STORAGE_KEY]);
  }

  return normalizeSidePanelToolKey(window.localStorage.getItem(ACTIVE_TOOL_STORAGE_KEY));
}

async function saveSidePanelTool(toolKey: SidePanelToolKey): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ACTIVE_TOOL_STORAGE_KEY]: toolKey });
    return;
  }

  window.localStorage.setItem(ACTIVE_TOOL_STORAGE_KEY, toolKey);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTodoDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`
  ].join(" ");
}

function getElapsedTodoDays(value: string): number {
  const createdAt = new Date(value).getTime();

  if (Number.isNaN(createdAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000));
}

type TodoContentProps = {
  readonly collapseLabel: string;
  readonly content: string;
  readonly expandLabel: string;
};

function TodoContent({ collapseLabel, content, expandLabel }: TodoContentProps) {
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const contentElement = contentRef.current;

    if (!contentElement) {
      return;
    }

    setIsExpanded(false);
    window.requestAnimationFrame(() => {
      setIsOverflowing(contentElement.scrollHeight > contentElement.clientHeight + 1);
    });
  }, [content]);

  return (
    <div className="todo-content">
      <p
        className={isExpanded ? "todo-content-text" : "todo-content-text todo-content-collapsed"}
        ref={contentRef}
      >
        {content}
      </p>
      {isOverflowing || isExpanded ? (
        <button
          className="todo-content-toggle"
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          {isExpanded ? collapseLabel : expandLabel}
        </button>
      ) : null}
    </div>
  );
}

function SidePanelApp() {
  const [locale, setLocale] = useState<Locale>(getDefaultLocale());
  const [activeTool, setActiveTool] = useState<SidePanelToolKey>("todoItems");
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [todoDraft, setTodoDraft] = useState<TodoDraft>(emptyTodoDraft);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [isTodoFormOpen, setIsTodoFormOpen] = useState(false);
  const [calculatorExpression, setCalculatorExpression] = useState("");
  const [calculatorResult, setCalculatorResult] = useState("");
  const [calculatorResultDescription, setCalculatorResultDescription] = useState("");
  const [calculatorHistory, setCalculatorHistory] = useState<readonly CalculatorHistoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getSavedLocale().then(setLocale);
    void getSavedSidePanelTool().then(setActiveTool);
    void getSavedCalculatorState().then((savedState) => {
      setCalculatorExpression(savedState.expression);
      setCalculatorResult(savedState.result);
      setCalculatorResultDescription(savedState.resultDescription);
      setCalculatorHistory(savedState.history);
    });
    void getTodoItems().then(setTodoItems);
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return;
    }

    const handleRuntimeMessage = (message: unknown) => {
      if (isCloseSidePanelMessage(message)) {
        window.close();
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const t = messages[locale];
  const completedTodoCount = useMemo(
    () => todoItems.filter((todoItem) => todoItem.completed).length,
    [todoItems]
  );
  const pendingTodoCount = todoItems.length - completedTodoCount;

  const resetTodoForm = () => {
    setEditingTodoId(null);
    setIsTodoFormOpen(false);
    setTodoDraft(emptyTodoDraft);
  };

  const handleTodoDraftChange =
    (field: keyof TodoDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setTodoDraft((currentDraft) => ({
        ...currentDraft,
        [field]: event.target.value
      }));
    };

  const handleAddTodo = () => {
    setEditingTodoId(null);
    setIsTodoFormOpen(true);
    setTodoDraft(emptyTodoDraft);
  };

  const handleSubmitTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    if (!todoDraft.title.trim()) {
      setMessage(t.todoRequired);
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = Boolean(editingTodoId);
      const nextItems = await saveTodoItem(todoItems, todoDraft, editingTodoId);
      setTodoItems(nextItems);
      setMessage(isEditing ? t.todoUpdated : t.todoSaved);
      resetTodoForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTodo = (todoItem: TodoItem) => {
    setEditingTodoId(todoItem.id);
    setIsTodoFormOpen(true);
    setTodoDraft({
      title: todoItem.title,
      content: todoItem.content
    });
  };

  const handleDeleteTodo = async (todoItem: TodoItem) => {
    if (!window.confirm(t.todoDeleteConfirm(todoItem.title))) {
      return;
    }

    const nextItems = await deleteTodoItem(todoItems, todoItem.id);
    setTodoItems(nextItems);
    setMessage(t.todoDeleted);

    if (editingTodoId === todoItem.id) {
      resetTodoForm();
    }
  };

  const handleToggleTodoCompleted = async (todoItem: TodoItem, completed: boolean) => {
    const confirmMessage = completed
      ? t.todoCompleteConfirm(todoItem.title)
      : t.todoReopenConfirm(todoItem.title);

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const nextItems = await updateTodoCompleted(todoItems, todoItem.id, completed);
    setTodoItems(nextItems);
  };

  const updateCalculatorState = (
    expression: string,
    result = "",
    resultDescription = ""
  ) => {
    setCalculatorExpression(expression);
    setCalculatorResult(result);
    setCalculatorResultDescription(resultDescription);
    void saveCalculatorState({ expression, result, resultDescription });
  };

  const handleCalculatorExpressionChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateCalculatorState(event.target.value);
  };

  const handleAppendCalculatorValue = (value: string) => {
    setCalculatorExpression((currentExpression) => {
      const nextExpression = `${currentExpression}${value}`;
      void saveCalculatorState({ expression: nextExpression, result: "", resultDescription: "" });
      return nextExpression;
    });
    setCalculatorResult("");
    setCalculatorResultDescription("");
  };

  const handleClearCalculator = () => {
    updateCalculatorState("");
  };

  const handleBackspaceCalculator = () => {
    setCalculatorExpression((currentExpression) => {
      const nextExpression = currentExpression.slice(0, -1);
      void saveCalculatorState({ expression: nextExpression, result: "", resultDescription: "" });
      return nextExpression;
    });
    setCalculatorResult("");
    setCalculatorResultDescription("");
  };

  const handlePercentCalculator = () => {
    setCalculatorExpression((currentExpression) => {
      const nextExpression = percentCurrentCalculatorNumber(currentExpression);
      void saveCalculatorState({ expression: nextExpression, result: "", resultDescription: "" });
      return nextExpression;
    });
    setCalculatorResult("");
    setCalculatorResultDescription("");
  };

  const handleToggleCalculatorSign = () => {
    setCalculatorExpression((currentExpression) => {
      const nextExpression = toggleCurrentCalculatorNumberSign(currentExpression);
      void saveCalculatorState({ expression: nextExpression, result: "", resultDescription: "" });
      return nextExpression;
    });
    setCalculatorResult("");
    setCalculatorResultDescription("");
  };

  const handleCalculate = () => {
    if (!calculatorExpression.trim()) {
      updateCalculatorState(calculatorExpression);
      return;
    }

    try {
      const result = evaluateCalculatorExpression(calculatorExpression);
      const formattedResult = formatCalculatorResult(result);
      const resultDescription = formatCalculatorChineseDescription(result);
      setCalculatorResult(formattedResult);
      setCalculatorResultDescription(resultDescription);
      void appendCalculatorHistoryItem({
        expression: calculatorExpression,
        result: formattedResult,
        resultDescription
      }).then((nextState) => {
        setCalculatorHistory(nextState.history);
      });
    } catch {
      updateCalculatorState(calculatorExpression, t.calculatorInvalid);
    }
  };

  const handleCalculatorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCalculate();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleClearCalculator();
    }
  };

  const handleCloseSidePanel = async () => {
    await saveSidePanelTool(activeTool);
    window.close();
  };

  return (
    <main className="sidepanel-shell">
      {message ? <p className="toast" role="status">{message}</p> : null}
      {activeTool === "calculator" ? (
        <>
          <header className="feature-header">
            <div>
              <h1>{t.calculator}</h1>
            </div>
            <div className="feature-actions">
              <button className="text-button" type="button" onClick={handleCloseSidePanel}>
                {t.closeSidePanel}
              </button>
            </div>
          </header>

          <section className="developer-form" aria-label={t.calculator}>
            <p className="tool-note">{t.calculatorHelp}</p>
            <div className="calculator-panel">
              <label className="calculator-display">
                {t.calculatorExpression}
                <input
                  autoComplete="off"
                  inputMode="decimal"
                  placeholder={t.calculatorPlaceholder}
                  value={calculatorExpression}
                  onChange={handleCalculatorExpressionChange}
                  onKeyDown={handleCalculatorKeyDown}
                />
              </label>
              <div className="calculator-result" aria-live="polite">
                <strong>{calculatorResult || "0"}</strong>
                {calculatorResultDescription ? (
                  <p className="calculator-result-description">{calculatorResultDescription}</p>
                ) : null}
              </div>
              <div className="calculator-keypad" aria-label={t.calculator}>
                <button type="button" onClick={handleBackspaceCalculator}>⌫</button>
                <button type="button" onClick={handleClearCalculator}>AC</button>
                <button type="button" onClick={handlePercentCalculator}>%</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("/")}>÷</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("7")}>7</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("8")}>8</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("9")}>9</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("*")}>×</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("4")}>4</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("5")}>5</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("6")}>6</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("-")}>-</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("1")}>1</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("2")}>2</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("3")}>3</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("+")}>+</button>
                <button type="button" onClick={handleToggleCalculatorSign}>+/-</button>
                <button type="button" onClick={() => handleAppendCalculatorValue("0")}>0</button>
                <button type="button" onClick={() => handleAppendCalculatorValue(".")}>.</button>
                <button className="calculator-equals" type="button" onClick={handleCalculate}>
                  =
                </button>
              </div>
            </div>
          </section>

          <section className="calculator-history" aria-label={t.calculatorHistory}>
            <div className="section-heading">
              <h2>{t.calculatorHistory}</h2>
            </div>
            {calculatorHistory.length > 0 ? (
              <div className="calculator-history-list" role="list">
                {calculatorHistory.map((historyItem) => (
                  <article className="calculator-history-item" key={historyItem.id} role="listitem">
                    <p
                      className="calculator-history-line"
                      title={`${historyItem.expression}=${historyItem.result}`}
                    >
                      <span>{historyItem.expression}=</span>
                      <strong>{historyItem.result}</strong>
                      {historyItem.resultDescription ? (
                        <span>({historyItem.resultDescription})</span>
                      ) : null}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="calculator-history-empty">{t.noCalculatorHistory}</p>
            )}
          </section>
        </>
      ) : (
        <>
      <header className="feature-header">
        <div>
          <h1>{t.todoItems}</h1>
        </div>
        <div className="feature-actions">
          <button className="text-button" type="button" onClick={handleCloseSidePanel}>
            {t.closeSidePanel}
          </button>
          <button className="primary-action" type="button" onClick={handleAddTodo}>
            {t.add}
          </button>
        </div>
      </header>

      <section className="todo-summary" aria-label={t.todoItems}>
        <div>
          <span>{t.todoStatsPending}</span>
          <strong>{pendingTodoCount}</strong>
        </div>
        <div>
          <span>{t.todoStatsCompleted}</span>
          <strong>{completedTodoCount}</strong>
        </div>
        <div>
          <span>{t.todoStatsTotal}</span>
          <strong>{todoItems.length}</strong>
        </div>
      </section>

      {isTodoFormOpen && !editingTodoId ? (
        <form className="developer-form" onSubmit={handleSubmitTodo}>
          <div className="section-heading">
            <h2>{t.add}</h2>
            <button className="text-button" disabled={isSaving} type="button" onClick={resetTodoForm}>
              {t.cancel}
            </button>
          </div>
          <label>
            {t.todoTitle}
            <input
              autoComplete="off"
              placeholder={t.todoTitlePlaceholder}
              required
              value={todoDraft.title}
              onChange={handleTodoDraftChange("title")}
            />
          </label>
          <label>
            {t.todoContent}
            <textarea
              placeholder={t.todoContentPlaceholder}
              value={todoDraft.content}
              onChange={handleTodoDraftChange("content")}
            />
          </label>
          <button className="primary-button" disabled={isSaving} type="submit">
            {t.save}
          </button>
        </form>
      ) : null}

      <section className="entry-list" aria-label={t.todoItems}>
        {todoItems.length > 0 ? (
          <div className="todo-list" role="list">
            {todoItems.map((todoItem) => (
              editingTodoId === todoItem.id ? (
                <form
                  className="developer-form todo-inline-form"
                  key={todoItem.id}
                  role="listitem"
                  onSubmit={handleSubmitTodo}
                >
                  <div className="section-heading">
                    <h2>{t.edit}</h2>
                    <button
                      className="text-button"
                      disabled={isSaving}
                      type="button"
                      onClick={resetTodoForm}
                    >
                      {t.cancel}
                    </button>
                  </div>
                  <label>
                    {t.todoTitle}
                    <input
                      autoComplete="off"
                      placeholder={t.todoTitlePlaceholder}
                      required
                      value={todoDraft.title}
                      onChange={handleTodoDraftChange("title")}
                    />
                  </label>
                  <label>
                    {t.todoContent}
                    <textarea
                      placeholder={t.todoContentPlaceholder}
                      value={todoDraft.content}
                      onChange={handleTodoDraftChange("content")}
                    />
                  </label>
                  <button className="primary-button" disabled={isSaving} type="submit">
                    {t.saveChanges}
                  </button>
                </form>
              ) : (
                <article
                  className={`todo-item${todoItem.completed ? " todo-item-completed" : ""}`}
                  key={todoItem.id}
                  role="listitem"
                >
                  <label className="todo-title-row">
                    <input
                      checked={todoItem.completed}
                      type="checkbox"
                      onChange={(event) =>
                        handleToggleTodoCompleted(todoItem, event.target.checked)
                      }
                    />
                    <span title={todoItem.title}>{todoItem.title}</span>
                  </label>
                  {todoItem.content ? (
                    <TodoContent
                      collapseLabel={t.collapse}
                      content={todoItem.content}
                      expandLabel={t.expand}
                    />
                  ) : null}
                  <p className="todo-meta">
                    {t.todoCreatedAt}: {formatTodoDateTime(todoItem.createdAt)}
                    <span>{t.todoElapsedDays(getElapsedTodoDays(todoItem.createdAt))}</span>
                  </p>
                  <div className="row-actions">
                    <button type="button" onClick={() => handleEditTodo(todoItem)}>
                      {t.edit}
                    </button>
                    <button type="button" onClick={() => handleDeleteTodo(todoItem)}>
                      {t.delete}
                    </button>
                  </div>
                </article>
              )
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>{t.noTodos}</p>
            <button className="text-button" type="button" onClick={handleAddTodo}>
              {t.add}
            </button>
          </div>
        )}
      </section>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <SidePanelApp />
  </StrictMode>
);
