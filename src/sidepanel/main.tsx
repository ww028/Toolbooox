import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  askChromeLanguageModelStreaming,
  initializeChromeLanguageModel,
  isChromeLanguageModelInitialized,
  prewarmChromeLanguageModel,
  summarizeAiAssistantConversationTurn,
  type LanguageModelInitializationUpdate
} from "../shared/aiAssistant/chromeLanguageModel";
import { consumeAiAssistantContextPrompt } from "../shared/aiAssistant/contextPrompt";
import {
  createAiAssistantKnowledgeMissingPrompt,
  createAiAssistantKnowledgePrompt,
  isAiAssistantKnowledgeSensitiveQuestion,
  isAiAssistantKnowledgeSaveCancellation,
  isAiAssistantKnowledgeSaveConfirmation,
  parseAiAssistantKnowledgeSaveRequest,
  saveAiAssistantKnowledgeItem,
  searchAiAssistantKnowledge,
  shouldUseAiAssistantKnowledge,
  type AiAssistantKnowledgeDraft
} from "../shared/aiAssistant/knowledgeBase";
import {
  getAiAssistantConversations,
  getSavedAiAssistantInitialized,
  saveAiAssistantConversations,
  saveAiAssistantInitialized,
  type AiAssistantConversation,
  type AiAssistantStoredMessage
} from "../shared/aiAssistant/storage";
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
import {
  createActivePageContextPrompt,
  getActivePageContent,
  shouldUseActivePageContent
} from "../shared/chrome/pageContent";
import { getDefaultLocale, getSavedLocale, type Locale } from "../shared/i18n/locale";
import { messages } from "../shared/i18n/messages";
import {
  isCloseSidePanelMessage,
  isOpenAiAssistantSidePanelMessage
} from "../shared/sidePanel/messages";
import {
  getSavedSidePanelTool,
  saveSidePanelTool,
  type SidePanelToolKey
} from "../shared/sidePanel/tools";
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
type AiAssistantInitializationStatus = "checking" | "needed" | "initializing" | "ready";
const AI_ASSISTANT_TITLE_MAX_LENGTH = 24;

function createClientId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatAiAssistantMessageTime(
  value: string | undefined,
  fallbackValue: string,
  locale: Locale
): string {
  const date = new Date(value ?? fallbackValue);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale);
}

function createConversationTitle(prompt: string): string {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();

  if (!normalizedPrompt) {
    return "新对话";
  }

  return normalizedPrompt.length > AI_ASSISTANT_TITLE_MAX_LENGTH
    ? `${normalizedPrompt.slice(0, AI_ASSISTANT_TITLE_MAX_LENGTH)}...`
    : normalizedPrompt;
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
  const [aiAssistantMessages, setAiAssistantMessages] = useState<AiAssistantStoredMessage[]>([]);
  const [aiAssistantConversations, setAiAssistantConversations] = useState<
    AiAssistantConversation[]
  >([]);
  const [activeAiAssistantConversationId, setActiveAiAssistantConversationId] =
    useState<string | null>(null);
  const [aiAssistantInput, setAiAssistantInput] = useState("");
  const [aiAssistantModelPromptOverride, setAiAssistantModelPromptOverride] = useState<{
    readonly input: string;
    readonly prompt: string;
  } | null>(null);
  const [pendingAiAssistantKnowledgeDraft, setPendingAiAssistantKnowledgeDraft] =
    useState<AiAssistantKnowledgeDraft | null>(null);
  const [aiAssistantInitializationStatus, setAiAssistantInitializationStatus] =
    useState<AiAssistantInitializationStatus>("checking");
  const [aiAssistantInitializationDetail, setAiAssistantInitializationDetail] = useState("");
  const [pendingAiAssistantAction, setPendingAiAssistantAction] = useState<
    "initializeAiAssistant" | "askAiAssistant" | null
  >(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const aiChatListRef = useRef<HTMLDivElement | null>(null);
  const aiAssistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldFocusAiAssistantInputRef = useRef(false);
  const activeAiAssistantConversationIdRef = useRef<string | null>(null);
  const aiAssistantMessagesRef = useRef<AiAssistantStoredMessage[]>([]);
  const aiAssistantConversationsRef = useRef<AiAssistantConversation[]>([]);

  activeAiAssistantConversationIdRef.current = activeAiAssistantConversationId;
  aiAssistantMessagesRef.current = aiAssistantMessages;
  aiAssistantConversationsRef.current = aiAssistantConversations;

  const loadAiAssistantContextPrompt = async (): Promise<boolean> => {
    const contextPrompt = await consumeAiAssistantContextPrompt();

    if (!contextPrompt) {
      return false;
    }

    shouldFocusAiAssistantInputRef.current = true;
    setActiveTool("aiAssistant");
    if (
      !activeAiAssistantConversationIdRef.current &&
      aiAssistantMessagesRef.current.length === 0
    ) {
      const [latestConversation] = aiAssistantConversationsRef.current;

      if (latestConversation) {
        setActiveAiAssistantConversationId(latestConversation.id);
        setAiAssistantMessages([...latestConversation.messages]);
      }
    }
    setAiAssistantModelPromptOverride(contextPrompt);
    setAiAssistantInput(contextPrompt.input);
    void saveSidePanelTool("aiAssistant").catch(() => undefined);
    return true;
  };

  useEffect(() => {
    void getSavedLocale().then(setLocale);
    void getSavedSidePanelTool().then(setActiveTool);
    void getSavedAiAssistantInitialized().then((isInitialized) => {
      setAiAssistantInitializationStatus(isInitialized ? "ready" : "needed");
    });
    void getAiAssistantConversations().then(async (conversations) => {
      aiAssistantConversationsRef.current = conversations;
      setAiAssistantConversations(conversations);
      const didLoadContextPrompt = await loadAiAssistantContextPrompt();

      if (didLoadContextPrompt) {
        return;
      }

      const [latestConversation] = conversations;
      if (latestConversation) {
        setActiveAiAssistantConversationId(latestConversation.id);
        setAiAssistantMessages([...latestConversation.messages]);
      }
    });
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
        return;
      }

      if (isOpenAiAssistantSidePanelMessage(message)) {
        void loadAiAssistantContextPrompt();
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
  const isAiAssistantReady = aiAssistantInitializationStatus === "ready";

  const scrollAiChatToBottom = () => {
    if (activeTool !== "aiAssistant") {
      return;
    }

    const scrollToBottom = () => {
      const chatList = aiChatListRef.current;

      if (chatList) {
        chatList.scrollTop = chatList.scrollHeight;
      }

      const pageScroller = document.scrollingElement;

      if (pageScroller) {
        pageScroller.scrollTop = pageScroller.scrollHeight;
      }
    };

    window.requestAnimationFrame(() => {
      scrollToBottom();
      window.requestAnimationFrame(scrollToBottom);
    });
  };

  useEffect(() => {
    scrollAiChatToBottom();
  }, [activeTool, aiAssistantMessages]);

  useEffect(() => {
    if (
      activeTool !== "aiAssistant" ||
      aiAssistantInitializationStatus !== "ready" ||
      isChromeLanguageModelInitialized()
    ) {
      return;
    }

    void prewarmChromeLanguageModel();
  }, [activeTool, aiAssistantInitializationStatus]);

  useEffect(() => {
    if (
      activeTool !== "aiAssistant" ||
      !isAiAssistantReady ||
      !aiAssistantInput.trim() ||
      !shouldFocusAiAssistantInputRef.current
    ) {
      return;
    }

    const inputElement = aiAssistantInputRef.current;

    if (!inputElement) {
      return;
    }

    inputElement.focus();
    inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
    shouldFocusAiAssistantInputRef.current = false;
  }, [activeTool, aiAssistantInput, isAiAssistantReady]);

  const getAiAssistantErrorMessage = (error: unknown): string => {
    const errorMessage = error instanceof Error ? error.message : "";

    if (errorMessage === "LANGUAGE_MODEL_TIMEOUT") {
      return t.aiAssistantTimeout;
    }

    if (
      errorMessage === "LANGUAGE_MODEL_UNSUPPORTED" ||
      errorMessage === "LANGUAGE_MODEL_UNAVAILABLE"
    ) {
      return t.aiAssistantUnavailable;
    }

    return t.aiAssistantFailed;
  };

  const getAiAssistantInitializationDetail = (
    update: LanguageModelInitializationUpdate
  ): string => {
    if (update.phase === "checking") {
      return t.aiAssistantInitializationChecking;
    }

    if (update.phase === "creating") {
      return t.aiAssistantInitializationCreating;
    }

    if (update.phase === "warming") {
      return t.aiAssistantInitializationWarming;
    }

    if (update.phase === "downloading") {
      return typeof update.downloadProgress === "number"
        ? `${t.aiAssistantInitializationDownloading} ${Math.round(
            update.downloadProgress * 100
          )}%`
        : t.aiAssistantInitializationDownloading;
    }

    return t.aiAssistantInitialized;
  };

  const handleInitializeAiAssistant = async () => {
    if (pendingAiAssistantAction === "initializeAiAssistant") {
      return;
    }

    setAiAssistantInitializationStatus("initializing");
    setAiAssistantInitializationDetail(t.aiAssistantInitializationChecking);
    setPendingAiAssistantAction("initializeAiAssistant");

    try {
      await initializeChromeLanguageModel((update) => {
        setAiAssistantInitializationDetail(getAiAssistantInitializationDetail(update));
      });
      await saveAiAssistantInitialized(true);
      setAiAssistantInitializationStatus("ready");
      setAiAssistantInitializationDetail("");
      setMessage(t.aiAssistantInitialized);
    } catch (error) {
      setAiAssistantInitializationStatus("needed");
      setAiAssistantInitializationDetail("");
      setMessage(getAiAssistantErrorMessage(error));
    } finally {
      setPendingAiAssistantAction(null);
    }
  };

  const persistAiAssistantConversation = async (
    conversation: AiAssistantConversation
  ): Promise<void> => {
    const nextConversations = await saveAiAssistantConversations([
      conversation,
      ...aiAssistantConversations.filter(
        (savedConversation) => savedConversation.id !== conversation.id
      )
    ]);
    setAiAssistantConversations(nextConversations);
  };

  const handleNewAiAssistantConversation = () => {
    setActiveAiAssistantConversationId(null);
    setAiAssistantMessages([]);
    setAiAssistantInput("");
    setAiAssistantModelPromptOverride(null);
    setMessage("");
  };

  const createAiAssistantReasoningMessage = (steps: readonly string[]): string =>
    [
      t.aiAssistantThinking,
      "",
      ...steps.map((step, index) => `${index + 1}. ${step}`)
    ].join("\n");

  const handleAskAiAssistant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingAiAssistantAction === "askAiAssistant") {
      return;
    }

    const prompt = aiAssistantInput.trim();

    if (!prompt) {
      return;
    }

    if (!isAiAssistantReady) {
      setMessage(t.aiAssistantInitializeFirst);
      return;
    }
    const appendAiAssistantLocalResponse = async (
      responseContent: string,
      options: {
        readonly shouldPersistKnowledge?: boolean;
        readonly shouldClearPendingKnowledge?: boolean;
      } = {}
    ) => {
      const messageCreatedAt = new Date().toISOString();
      const userMessage: AiAssistantStoredMessage = {
        id: createClientId("ai-user"),
        role: "user",
        content: prompt,
        createdAt: messageCreatedAt
      };
      const assistantMessage: AiAssistantStoredMessage = {
        id: createClientId("ai-assistant"),
        role: "assistant",
        content: responseContent,
        createdAt: messageCreatedAt
      };
      const currentConversation = aiAssistantConversations.find(
        (conversation) => conversation.id === activeAiAssistantConversationId
      );
      const conversationId = currentConversation?.id ?? createClientId("ai-conversation");
      const createdAt = currentConversation?.createdAt ?? new Date().toISOString();
      const title = currentConversation?.title ?? createConversationTitle(prompt);

      setAiAssistantMessages((currentMessages) => [
        ...currentMessages,
        userMessage,
        assistantMessage
      ]);
      setActiveAiAssistantConversationId(conversationId);
      setAiAssistantInput("");
      setAiAssistantModelPromptOverride(null);
      setPendingAiAssistantAction("askAiAssistant");
      scrollAiChatToBottom();

      try {
        if (options.shouldPersistKnowledge && pendingAiAssistantKnowledgeDraft) {
          await saveAiAssistantKnowledgeItem(pendingAiAssistantKnowledgeDraft);
        }
        if (options.shouldClearPendingKnowledge) {
          setPendingAiAssistantKnowledgeDraft(null);
        }
        await persistAiAssistantConversation({
          id: conversationId,
          title,
          summary: currentConversation?.summary,
          messages: [...aiAssistantMessages, userMessage, assistantMessage],
          createdAt,
          updatedAt: new Date().toISOString()
        });
        setMessage(responseContent);
      } catch {
        setMessage(t.aiAssistantFailed);
      } finally {
        setPendingAiAssistantAction(null);
      }
    };

    if (pendingAiAssistantKnowledgeDraft) {
      if (isAiAssistantKnowledgeSaveConfirmation(prompt)) {
        await appendAiAssistantLocalResponse(t.aiAssistantKnowledgeSaved, {
          shouldPersistKnowledge: true,
          shouldClearPendingKnowledge: true
        });
        return;
      }

      if (isAiAssistantKnowledgeSaveCancellation(prompt)) {
        await appendAiAssistantLocalResponse(t.aiAssistantKnowledgeCanceled, {
          shouldClearPendingKnowledge: true
        });
        return;
      }

      await appendAiAssistantLocalResponse(t.aiAssistantKnowledgeAwaitingConfirmation);
      return;
    }

    const knowledgeSaveDraft = parseAiAssistantKnowledgeSaveRequest(prompt);

    if (knowledgeSaveDraft) {
      setPendingAiAssistantKnowledgeDraft(knowledgeSaveDraft);
      await appendAiAssistantLocalResponse(
        t.aiAssistantKnowledgeConfirmSave(
          knowledgeSaveDraft.title,
          knowledgeSaveDraft.content,
          knowledgeSaveDraft.tags
        )
      );
      return;
    }

    let modelPrompt =
      aiAssistantModelPromptOverride?.input.trim() === prompt
        ? aiAssistantModelPromptOverride.prompt
        : prompt;
    const shouldReadActivePage =
      !aiAssistantModelPromptOverride && shouldUseActivePageContent(prompt);
    const messageCreatedAt = new Date().toISOString();
    const userMessage: AiAssistantStoredMessage = {
      id: createClientId("ai-user"),
      role: "user",
      content: prompt,
      createdAt: messageCreatedAt
    };
    const assistantMessageId = createClientId("ai-assistant");
    const pendingAssistantMessage: AiAssistantStoredMessage = {
      id: assistantMessageId,
      role: "assistant",
      createdAt: messageCreatedAt,
      content: createAiAssistantReasoningMessage(
        shouldReadActivePage
          ? [t.aiAssistantReasoningReadingPage]
          : [t.aiAssistantReasoningCheckingKnowledge]
      )
    };
    const currentConversation = aiAssistantConversations.find(
      (conversation) => conversation.id === activeAiAssistantConversationId
    );
    const conversationId = currentConversation?.id ?? createClientId("ai-conversation");
    const createdAt = currentConversation?.createdAt ?? new Date().toISOString();
    const title = currentConversation?.title ?? createConversationTitle(prompt);

    setAiAssistantMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      pendingAssistantMessage
    ]);
    setActiveAiAssistantConversationId(conversationId);
    setAiAssistantConversations((currentConversations) => [
      {
        id: conversationId,
        title,
        summary: currentConversation?.summary,
        messages: [...aiAssistantMessages, userMessage, pendingAssistantMessage],
        createdAt,
        updatedAt: new Date().toISOString()
      },
      ...currentConversations.filter((conversation) => conversation.id !== conversationId)
    ]);
    setAiAssistantInput("");
    setAiAssistantModelPromptOverride(null);
    setPendingAiAssistantAction("askAiAssistant");
    scrollAiChatToBottom();

    try {
      const updateReasoningMessage = (steps: readonly string[]) => {
        setAiAssistantMessages((currentMessages) =>
          currentMessages.map((chatMessage) =>
            chatMessage.id === assistantMessageId
              ? { ...chatMessage, content: createAiAssistantReasoningMessage(steps) }
              : chatMessage
          )
        );
        scrollAiChatToBottom();
      };

      if (shouldReadActivePage) {
        const activePageContent = await getActivePageContent().catch(() => null);

        if (activePageContent) {
          modelPrompt = createActivePageContextPrompt(prompt, activePageContent);
        } else {
          setAiAssistantMessages(aiAssistantMessages);
          setAiAssistantConversations((currentConversations) =>
            currentConversation
              ? currentConversations.map((conversation) =>
                  conversation.id === conversationId ? currentConversation : conversation
                )
              : currentConversations.filter((conversation) => conversation.id !== conversationId)
          );
          setActiveAiAssistantConversationId(currentConversation?.id ?? null);
          setMessage(t.aiAssistantPageContextUnavailable);
          return;
        }

        updateReasoningMessage([
          t.aiAssistantReasoningReadingPage,
          t.aiAssistantReasoningCheckingKnowledge
        ]);
      }

      const knowledgeSnippets = await searchAiAssistantKnowledge(prompt).catch(() => []);

      if (knowledgeSnippets.length > 0) {
        modelPrompt = createAiAssistantKnowledgePrompt(prompt, modelPrompt, knowledgeSnippets);
      } else if (
        shouldUseAiAssistantKnowledge(prompt) &&
        isAiAssistantKnowledgeSensitiveQuestion(prompt)
      ) {
        modelPrompt = createAiAssistantKnowledgeMissingPrompt(prompt, modelPrompt);
      }

      updateReasoningMessage([
        ...(shouldReadActivePage ? [t.aiAssistantReasoningReadingPage] : []),
        t.aiAssistantReasoningCheckingKnowledge,
        t.aiAssistantReasoningComposing,
        t.aiAssistantReasoningCallingModel
      ]);

      let nextAnswer = "";
      await askChromeLanguageModelStreaming(
        modelPrompt,
        (chunk) => {
          nextAnswer += chunk;
          setAiAssistantMessages((currentMessages) =>
            currentMessages.map((chatMessage) =>
              chatMessage.id === assistantMessageId
                ? { ...chatMessage, content: nextAnswer }
                : chatMessage
            )
          );
          scrollAiChatToBottom();
        },
        {
          conversationSummary: currentConversation?.summary,
          messages: aiAssistantMessages
        }
      );
      const nextSummary = await summarizeAiAssistantConversationTurn({
        previousSummary: currentConversation?.summary,
        userPrompt: prompt,
        assistantAnswer: nextAnswer
      }).catch(() => currentConversation?.summary ?? "");
      await persistAiAssistantConversation({
        id: conversationId,
        title,
        summary: nextSummary || undefined,
        messages: [
          ...aiAssistantMessages,
          userMessage,
          {
            id: assistantMessageId,
            role: "assistant",
            content: nextAnswer,
            createdAt: messageCreatedAt
          }
        ],
        createdAt,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";

      setAiAssistantMessages((currentMessages) =>
        currentMessages.filter((chatMessage) => chatMessage.id !== assistantMessageId)
      );
      await persistAiAssistantConversation({
        id: conversationId,
        title,
        summary: currentConversation?.summary,
        messages: [...aiAssistantMessages, userMessage],
        createdAt,
        updatedAt: new Date().toISOString()
      });

      if (
        errorMessage === "LANGUAGE_MODEL_UNAVAILABLE" ||
        errorMessage === "LANGUAGE_MODEL_UNSUPPORTED"
      ) {
        setAiAssistantInitializationStatus("needed");
        void saveAiAssistantInitialized(false);
      }

      setMessage(getAiAssistantErrorMessage(error));
    } finally {
      setPendingAiAssistantAction(null);
    }
  };

  const handleAiAssistantInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

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
    <main className={`sidepanel-shell${activeTool === "aiAssistant" ? " sidepanel-shell-ai" : ""}`}>
      {message ? <p className="toast" role="status">{message}</p> : null}
      {activeTool === "aiAssistant" ? (
        <>
          <header className="feature-header ai-sidepanel-header">
            <div>
              <h1>{t.aiAssistant}</h1>
            </div>
            <div className="feature-actions">
              <button
                className="text-button"
                disabled={aiAssistantMessages.length === 0 && !aiAssistantInput}
                type="button"
                onClick={handleNewAiAssistantConversation}
              >
                {t.aiAssistantNewConversation}
              </button>
              <button className="text-button" type="button" onClick={handleCloseSidePanel}>
                {t.closeSidePanel}
              </button>
            </div>
          </header>

          <section className="ai-sidepanel-chat" aria-label={t.aiAssistant}>
            {!isAiAssistantReady ? (
              <div className="ai-sidepanel-initialization">
                <div>
                  <strong>{t.aiAssistantInitializeFirst}</strong>
                  {aiAssistantInitializationDetail ? (
                    <span>{aiAssistantInitializationDetail}</span>
                  ) : null}
                </div>
                <button
                  className="primary-action"
                  disabled={
                    aiAssistantInitializationStatus === "checking" ||
                    pendingAiAssistantAction === "initializeAiAssistant"
                  }
                  type="button"
                  onClick={handleInitializeAiAssistant}
                >
                  {aiAssistantInitializationStatus === "initializing" ||
                  pendingAiAssistantAction === "initializeAiAssistant"
                    ? t.aiAssistantInitializing
                    : t.aiAssistantInitialize}
                </button>
              </div>
            ) : null}

            <div className="ai-sidepanel-chat-list" ref={aiChatListRef} role="log">
              {aiAssistantMessages.length > 0 ? (
                aiAssistantMessages.map((chatMessage) => {
                  const messageTime = formatAiAssistantMessageTime(
                    chatMessage.createdAt,
                    activeAiAssistantConversationId
                      ? (aiAssistantConversations.find(
                          (conversation) => conversation.id === activeAiAssistantConversationId
                        )?.updatedAt ?? new Date().toISOString())
                      : new Date().toISOString(),
                    locale
                  );

                  return (
                    <article
                      className={`ai-sidepanel-message ai-sidepanel-message-${chatMessage.role}`}
                      key={chatMessage.id}
                    >
                      <div className="ai-sidepanel-meta">
                        <span className="ai-sidepanel-role">
                          {chatMessage.role === "user" ? t.aiAssistantUser : t.aiAssistant}
                        </span>
                        {messageTime ? (
                          <time
                            className="ai-sidepanel-time"
                            dateTime={chatMessage.createdAt}
                          >
                            {messageTime}
                          </time>
                        ) : null}
                      </div>
                      <div className="ai-sidepanel-content">{chatMessage.content}</div>
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <p>{t.aiAssistantEmpty}</p>
                </div>
              )}
            </div>
          </section>

          <form className="ai-sidepanel-composer" onSubmit={handleAskAiAssistant}>
            <textarea
              ref={aiAssistantInputRef}
              aria-label={t.aiAssistantPrompt}
              disabled={!isAiAssistantReady || pendingAiAssistantAction === "askAiAssistant"}
              placeholder={t.aiAssistantPromptPlaceholder}
              value={aiAssistantInput}
              onChange={(event) => {
                setAiAssistantModelPromptOverride(null);
                setAiAssistantInput(event.target.value);
              }}
              onKeyDown={handleAiAssistantInputKeyDown}
            />
            <div className="ai-sidepanel-composer-footer">
              <span>{t.aiAssistantSendShortcutHint}</span>
              <button
                className="primary-action"
                disabled={
                  !isAiAssistantReady ||
                  pendingAiAssistantAction === "initializeAiAssistant" ||
                  pendingAiAssistantAction === "askAiAssistant" ||
                  !aiAssistantInput.trim()
                }
                type="submit"
              >
                {pendingAiAssistantAction === "askAiAssistant" ? t.aiAssistantThinking : t.send}
              </button>
            </div>
          </form>
        </>
      ) : activeTool === "calculator" ? (
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
