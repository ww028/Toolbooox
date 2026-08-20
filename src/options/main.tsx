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
import { getDefaultLocale, getSavedLocale, type Locale } from "../shared/i18n/locale";
import { messages } from "../shared/i18n/messages";
import {
  applyTextDiffBlockChange,
  createTextDiff,
  createTextDiffBlocks,
  createTextDiffDisplayBlocks,
  DEFAULT_UNCHANGED_COLLAPSE_THRESHOLD,
  getTextDiffBlockKey,
  type TextDiffBlock,
  type TextDiffLine
} from "../shared/textCompare/diff";
import {
  getSavedTextCompareState,
  saveTextCompareState
} from "../shared/textCompare/storage";
import manifest from "../../public/manifest.json";
import "./styles.css";

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

function OptionsApp() {
  const searchParams = new URLSearchParams(window.location.search);
  const optionsTool = searchParams.get("tool") === "aiAssistant" ? "aiAssistant" : "textCompare";
  const initialAiAssistantPrompt = searchParams.get("prompt") ?? "";
  const shouldLoadAiAssistantContextPrompt = searchParams.get("contextPrompt") === "1";
  const [locale, setLocale] = useState<Locale>(getDefaultLocale());
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [diffLines, setDiffLines] = useState<TextDiffLine[] | null>(null);
  const [expandedDiffBlockKeys, setExpandedDiffBlockKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
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
  const [pendingAction, setPendingAction] = useState<"initializeAiAssistant" | "askAiAssistant" | null>(
    null
  );
  const [message, setMessage] = useState("");
  const aiChatListRef = useRef<HTMLDivElement | null>(null);
  const aiAssistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldFocusAiAssistantInputRef = useRef(false);

  useEffect(() => {
    void getSavedLocale().then(setLocale);
    void getSavedAiAssistantInitialized().then((isInitialized) => {
      setAiAssistantInitializationStatus(isInitialized ? "ready" : "needed");
    });
    void getAiAssistantConversations().then(async (conversations) => {
      setAiAssistantConversations(conversations);
      const contextPrompt = shouldLoadAiAssistantContextPrompt
        ? await consumeAiAssistantContextPrompt()
        : null;
      const nextInitialAiAssistantPrompt = contextPrompt?.input || initialAiAssistantPrompt;

      if (nextInitialAiAssistantPrompt) {
        shouldFocusAiAssistantInputRef.current = true;
        setAiAssistantModelPromptOverride(contextPrompt);
        setAiAssistantInput(nextInitialAiAssistantPrompt);
        return;
      }

      const [latestConversation] = conversations;
      if (latestConversation) {
        setActiveAiAssistantConversationId(latestConversation.id);
        setAiAssistantMessages([...latestConversation.messages]);
      }
    });
    void getSavedTextCompareState().then((savedState) => {
      setLeftText(savedState.leftText);
      setRightText(savedState.rightText);

      if (savedState.hasCompared) {
        setDiffLines(createTextDiff(savedState.leftText, savedState.rightText));
      }
    });
  }, [initialAiAssistantPrompt, shouldLoadAiAssistantContextPrompt]);

  const t = messages[locale];
  const isAiAssistantReady = aiAssistantInitializationStatus === "ready";
  const diffBlocks = useMemo(
    () => (diffLines ? createTextDiffBlocks(diffLines) : []),
    [diffLines]
  );

  useEffect(() => {
    if (optionsTool !== "aiAssistant") {
      return;
    }

    const chatList = aiChatListRef.current;

    if (!chatList) {
      return;
    }

    chatList.scrollTo({
      top: chatList.scrollHeight,
      behavior: "smooth"
    });
  }, [optionsTool, aiAssistantMessages]);

  useEffect(() => {
    if (
      optionsTool !== "aiAssistant" ||
      aiAssistantInitializationStatus !== "ready" ||
      isChromeLanguageModelInitialized()
    ) {
      return;
    }

    void prewarmChromeLanguageModel();
  }, [aiAssistantInitializationStatus, optionsTool]);

  useEffect(() => {
    if (
      optionsTool !== "aiAssistant" ||
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
  }, [aiAssistantInput, isAiAssistantReady, optionsTool]);

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
    if (pendingAction === "initializeAiAssistant") {
      return;
    }

    setAiAssistantInitializationStatus("initializing");
    setAiAssistantInitializationDetail(t.aiAssistantInitializationChecking);
    setPendingAction("initializeAiAssistant");

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
      setPendingAction(null);
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

  const handleSelectAiAssistantConversation = (conversation: AiAssistantConversation) => {
    setActiveAiAssistantConversationId(conversation.id);
    setAiAssistantMessages([...conversation.messages]);
    setAiAssistantInput("");
    setAiAssistantModelPromptOverride(null);
    setMessage("");
  };

  const handleNewAiAssistantConversation = () => {
    setActiveAiAssistantConversationId(null);
    setAiAssistantMessages([]);
    setAiAssistantInput("");
    setAiAssistantModelPromptOverride(null);
    setMessage("");
  };

  const handleAskAiAssistant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingAction === "askAiAssistant") {
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
      setPendingAction("askAiAssistant");

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
        setPendingAction(null);
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
      content: createAiAssistantReasoningMessage([
        t.aiAssistantReasoningCheckingKnowledge
      ])
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
    setPendingAction("askAiAssistant");

    try {
      const updateReasoningMessage = (steps: readonly string[]) => {
        setAiAssistantMessages((currentMessages) =>
          currentMessages.map((chatMessage) =>
            chatMessage.id === assistantMessageId
              ? { ...chatMessage, content: createAiAssistantReasoningMessage(steps) }
              : chatMessage
          )
        );
      };
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
      setPendingAction(null);
    }
  };

  const handleClearAiAssistant = () => {
    handleNewAiAssistantConversation();
  };

  const createAiAssistantReasoningMessage = (steps: readonly string[]): string =>
    [
      t.aiAssistantThinking,
      "",
      ...steps.map((step, index) => `${index + 1}. ${step}`)
    ].join("\n");

  const handleAiAssistantInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const displayDiffBlocks = useMemo(
    () => createTextDiffDisplayBlocks(diffBlocks, expandedDiffBlockKeys),
    [diffBlocks, expandedDiffBlockKeys]
  );

  const handleLeftTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextLeftText = event.target.value;
    setLeftText(nextLeftText);
    setDiffLines(null);
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText: nextLeftText,
      rightText,
      hasCompared: false
    });
  };

  const handleRightTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextRightText = event.target.value;
    setRightText(nextRightText);
    setDiffLines(null);
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText,
      rightText: nextRightText,
      hasCompared: false
    });
  };

  const handleCompare = () => {
    setDiffLines(createTextDiff(leftText, rightText));
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText,
      rightText,
      hasCompared: true
    });
  };

  const handleClear = () => {
    setLeftText("");
    setRightText("");
    setDiffLines(null);
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText: "",
      rightText: "",
      hasCompared: false
    });
  };

  const applyDiffBlock = (block: TextDiffBlock, source: "left" | "right") => {
    const nextText = applyTextDiffBlockChange(leftText, rightText, block, source);

    setLeftText(nextText.leftText);
    setRightText(nextText.rightText);
    setDiffLines(createTextDiff(nextText.leftText, nextText.rightText));
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText: nextText.leftText,
      rightText: nextText.rightText,
      hasCompared: true
    });
  };

  const toggleDiffBlock = (blockKey: string) => {
    setExpandedDiffBlockKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(blockKey)) {
        nextKeys.delete(blockKey);
      } else {
        nextKeys.add(blockKey);
      }

      return nextKeys;
    });
  };

  if (optionsTool === "aiAssistant") {
    return (
      <main className="options-shell ai-options-shell">
        {message ? <p className="options-toast" role="status">{message}</p> : null}
        <header className="options-header">
          <div>
            <h1>{t.aiAssistant}</h1>
            <p className="options-description">{t.aiAssistantGuide}</p>
          </div>
          <div className="header-actions">
            <span className="version-badge">{t.version}: {manifest.version}</span>
            <button
              className="text-button"
              disabled={aiAssistantMessages.length === 0 && !aiAssistantInput}
              type="button"
              onClick={handleClearAiAssistant}
            >
              {t.clear}
            </button>
          </div>
        </header>

        <section className="ai-options-panel" aria-label={t.aiAssistant}>
          <aside className="ai-history-sidebar" aria-label={t.aiAssistantHistory}>
            <div className="ai-history-header">
              <h2>{t.aiAssistantHistory}</h2>
              <button
                className="text-button"
                type="button"
                onClick={handleNewAiAssistantConversation}
              >
                {t.aiAssistantNewConversation}
              </button>
            </div>
            <div className="ai-history-list">
              {aiAssistantConversations.length > 0 ? (
                aiAssistantConversations.map((conversation) => (
                  <button
                    aria-current={
                      conversation.id === activeAiAssistantConversationId ? "page" : undefined
                    }
                    className="ai-history-item"
                    key={conversation.id}
                    type="button"
                    onClick={() => handleSelectAiAssistantConversation(conversation)}
                  >
                    <span>{conversation.title}</span>
                    <time dateTime={conversation.updatedAt}>
                      {new Date(conversation.updatedAt).toLocaleString(locale)}
                    </time>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <p>{t.aiAssistantNoHistory}</p>
                </div>
              )}
            </div>
          </aside>

          <div className="ai-options-main">
            <div className="ai-options-chat-surface">
              {!isAiAssistantReady ? (
                <div className="ai-initialization-panel">
                  <div className="ai-initialization-copy">
                    <strong>{t.aiAssistantInitializeFirst}</strong>
                    {aiAssistantInitializationDetail ? (
                      <span>{aiAssistantInitializationDetail}</span>
                    ) : null}
                  </div>
                  <button
                    className="primary-action"
                    disabled={
                      aiAssistantInitializationStatus === "checking" ||
                      pendingAction === "initializeAiAssistant"
                    }
                    type="button"
                    onClick={handleInitializeAiAssistant}
                  >
                    {aiAssistantInitializationStatus === "initializing" ||
                    pendingAction === "initializeAiAssistant"
                      ? t.aiAssistantInitializing
                      : t.aiAssistantInitialize}
                  </button>
                </div>
              ) : null}

              <div className="ai-options-chat-list" ref={aiChatListRef} role="log">
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
                        className={`ai-chat-message ai-chat-message-${chatMessage.role}`}
                        key={chatMessage.id}
                      >
                        <div className="ai-chat-meta">
                          <span className="ai-chat-role">
                            {chatMessage.role === "user" ? t.aiAssistantUser : t.aiAssistant}
                          </span>
                          {messageTime ? (
                            <time
                              className="ai-chat-time"
                              dateTime={chatMessage.createdAt}
                            >
                              {messageTime}
                            </time>
                          ) : null}
                        </div>
                        <div className="ai-chat-content">{chatMessage.content}</div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p>{t.aiAssistantEmpty}</p>
                  </div>
                )}
              </div>
            </div>

            <form className="ai-options-composer" onSubmit={handleAskAiAssistant}>
              <textarea
                ref={aiAssistantInputRef}
                aria-label={t.aiAssistantPrompt}
                placeholder={t.aiAssistantPromptPlaceholder}
                disabled={!isAiAssistantReady || pendingAction === "askAiAssistant"}
                value={aiAssistantInput}
                onChange={(event) => {
                  setAiAssistantModelPromptOverride(null);
                  setAiAssistantInput(event.target.value);
                }}
                onKeyDown={handleAiAssistantInputKeyDown}
              />
              <div className="ai-options-composer-footer">
                <span>{t.aiAssistantSendShortcutHint}</span>
                <button
                  className="primary-action"
                  disabled={
                    !isAiAssistantReady ||
                    pendingAction === "initializeAiAssistant" ||
                    pendingAction === "askAiAssistant" ||
                    !aiAssistantInput.trim()
                  }
                  type="submit"
                >
                  {pendingAction === "askAiAssistant" ? t.aiAssistantThinking : t.send}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`options-shell${diffLines ? " has-diff" : ""}`}>
      <header className="options-header">
        <div>
          <h1>{t.longTextCompare}</h1>
          <p className="options-description">{t.longTextCompareHelp}</p>
        </div>
        <div className="header-actions">
          <span className="version-badge">{t.version}: {manifest.version}</span>
          <button className="text-button" type="button" onClick={handleClear}>
            {t.clear}
          </button>
          <button className="primary-action" type="button" onClick={handleCompare}>
            {t.compareText}
          </button>
        </div>
      </header>

      <section className="compare-workspace" aria-label={t.longTextCompare}>
        <label className="text-compare-field">
          <span>{t.originalText}</span>
          <textarea
            spellCheck="false"
            value={leftText}
            onChange={handleLeftTextChange}
          />
        </label>
        <label className="text-compare-field">
          <span>{t.changedText}</span>
          <textarea
            spellCheck="false"
            value={rightText}
            onChange={handleRightTextChange}
          />
        </label>
      </section>

      {diffLines ? (
        <section className="diff-section" aria-label={t.textCompareResult}>
          <div className="section-heading">
            <h2>{t.textCompareResult}</h2>
          </div>
          <div className="diff-output" role="list">
            {displayDiffBlocks.map((diffBlock, blockIndex) => (
              <div className="diff-block" key={`${diffBlock.type}-${blockIndex}`}>
                {diffBlock.type === "collapsed" ? (
                  <button
                    className="diff-collapsed-line"
                    type="button"
                    onClick={() => toggleDiffBlock(diffBlock.key)}
                  >
                    <span className="diff-line-number">{diffBlock.leftStartLineNumber}</span>
                    <span className="diff-line-number">{diffBlock.rightStartLineNumber}</span>
                    <span className="diff-line-marker">...</span>
                    <span>{t.expandUnchangedLines(diffBlock.lineCount)}</span>
                  </button>
                ) : null}
                {diffBlock.type === "unchanged" &&
                diffBlock.lines.length > DEFAULT_UNCHANGED_COLLAPSE_THRESHOLD ? (
                  <button
                    className="diff-collapsed-line"
                    type="button"
                    onClick={() => toggleDiffBlock(getTextDiffBlockKey(diffBlock))}
                  >
                    <span className="diff-line-number">
                      {diffBlock.lines[0]?.leftLineNumber ?? diffBlock.leftStartIndex + 1}
                    </span>
                    <span className="diff-line-number">
                      {diffBlock.lines[0]?.rightLineNumber ?? diffBlock.rightStartIndex + 1}
                    </span>
                    <span className="diff-line-marker">...</span>
                    <span>{t.collapseUnchangedLines(diffBlock.lines.length)}</span>
                  </button>
                ) : null}
                {diffBlock.type === "changed" ? (
                  <div className="diff-block-actions">
                    <button type="button" onClick={() => applyDiffBlock(diffBlock, "left")}>
                      {t.acceptLeft}
                    </button>
                    <button type="button" onClick={() => applyDiffBlock(diffBlock, "right")}>
                      {t.acceptRight}
                    </button>
                  </div>
                ) : null}
                {diffBlock.type !== "collapsed" ? diffBlock.lines.map((diffLine, lineIndex) => (
                  <div
                    className={`diff-line diff-line-${diffLine.type}`}
                    key={`${diffLine.type}-${blockIndex}-${lineIndex}`}
                    role="listitem"
                  >
                    <span className="diff-line-number">
                      {diffLine.leftLineNumber ?? ""}
                    </span>
                    <span className="diff-line-number">
                      {diffLine.rightLineNumber ?? ""}
                    </span>
                    <span className="diff-line-marker">
                      {diffLine.type === "added"
                        ? "+"
                        : diffLine.type === "removed"
                          ? "-"
                          : " "}
                    </span>
                    <code>
                      {diffLine.segments?.length
                        ? diffLine.segments.map((segment, segmentIndex) => (
                            <span
                              className={segment.highlighted ? "diff-segment-highlight" : undefined}
                              key={`${segment.value}-${segmentIndex}`}
                            >
                              {segment.value}
                            </span>
                          ))
                        : diffLine.value || " "}
                    </code>
                  </div>
                )) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>
);
