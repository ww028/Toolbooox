import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  clearCapturedCookieHeader,
  doesRequestMatchCookieCaptureUrl,
  formatCookieHeader,
  getCapturedCookieHeader,
  getCookiesForUrl,
  getCookieCaptureRequestUrl,
  parseCookieHeader,
  saveCookieCaptureRequestUrl,
  subscribeCapturedCookieHeaderChanges,
  type CapturedCookieHeader
} from "../shared/chrome/cookies";
import { getActiveTabInfo, type ActiveTabInfo, updateActiveTabUrl } from "../shared/chrome/tabs";
import {
  buildSwitchedDomainUrl,
  deleteDomainSwitcherRule,
  getDomainSwitcherRules,
  isValidDomainSwitcherDraft,
  saveDomainSwitcherRule,
  type DomainSwitcherDraft,
  type DomainSwitcherRule
} from "../shared/devTools/domainSwitcher";
import { getDefaultLocale, getSavedLocale, saveLocale, type Locale } from "../shared/i18n/locale";
import { messages } from "../shared/i18n/messages";
import {
  createPasswordVaultExport,
  deletePasswordEntry,
  getPasswordEntries,
  PasswordVaultError,
  replacePasswordEntries,
  savePasswordEntry
} from "../shared/passwordVault/storage";
import type {
  PasswordEntry,
  PasswordEntryDraft,
  PasswordVaultExport
} from "../shared/passwordVault/types";
import { getPaginatedItems, getTotalPages } from "../shared/passwordVault/pagination";
import { getHostname, isSameOrSubdomain } from "../shared/passwordVault/urlMatcher";
import manifest from "../../public/manifest.json";
import "./styles.css";

type FormState = {
  readonly displayName: string;
  readonly url: string;
  readonly username: string;
  readonly password: string;
};

const PRIMARY_TOOL_KEYS = ["passwordManager", "domainSwitcher", "cookieViewer"] as const;

type PrimaryToolKey = (typeof PRIMARY_TOOL_KEYS)[number];
type ToolKey = PrimaryToolKey | "settings";
type MenuSettings = {
  readonly order: PrimaryToolKey[];
  readonly hidden: PrimaryToolKey[];
};
type SavedEntriesTab = "otherSites" | "all";
type PendingAction =
  | "save"
  | "import"
  | "export"
  | "saveDomainRule"
  | "switchDomain"
  | "saveCookieRequestUrl"
  | null;

const emptyForm: FormState = {
  displayName: "",
  url: "",
  username: "",
  password: ""
};

const emptyDomainSwitcherDraft: DomainSwitcherDraft = {
  onlineDomain: "",
  localDomain: ""
};

const PASSWORD_PAGE_SIZE = 10;
const ACTIVE_TOOL_STORAGE_KEY = "toolbooox.activeTool";
const MENU_SETTINGS_STORAGE_KEY = "toolbooox.menuSettings";
const DEFAULT_LOCAL_DOMAIN = "localhost:";
const defaultMenuSettings: MenuSettings = {
  order: [...PRIMARY_TOOL_KEYS],
  hidden: []
};

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function isToolKey(value: unknown): value is ToolKey {
  return (
    value === "passwordManager" ||
    value === "domainSwitcher" ||
    value === "cookieViewer" ||
    value === "settings"
  );
}

function isPrimaryToolKey(value: unknown): value is PrimaryToolKey {
  return PRIMARY_TOOL_KEYS.some((toolKey) => toolKey === value);
}

function normalizeSavedToolKey(value: unknown): ToolKey {
  if (value === "developerTools") {
    return "domainSwitcher";
  }

  return isToolKey(value) ? value : "passwordManager";
}

async function getSavedActiveTool(): Promise<ToolKey> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(ACTIVE_TOOL_STORAGE_KEY);
    return normalizeSavedToolKey(result[ACTIVE_TOOL_STORAGE_KEY]);
  }

  const activeTool = window.localStorage.getItem(ACTIVE_TOOL_STORAGE_KEY);
  return normalizeSavedToolKey(activeTool);
}

async function saveActiveTool(toolKey: ToolKey): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ACTIVE_TOOL_STORAGE_KEY]: toolKey });
    return;
  }

  window.localStorage.setItem(ACTIVE_TOOL_STORAGE_KEY, toolKey);
}

function normalizeMenuSettings(value: unknown): MenuSettings {
  if (!value || typeof value !== "object") {
    return defaultMenuSettings;
  }

  const savedSettings = value as Partial<MenuSettings>;
  const normalizedOrder = Array.isArray(savedSettings.order)
    ? savedSettings.order.filter(isPrimaryToolKey)
    : [];
  const order = [
    ...normalizedOrder,
    ...PRIMARY_TOOL_KEYS.filter((toolKey) => !normalizedOrder.includes(toolKey))
  ];
  const hidden = Array.isArray(savedSettings.hidden)
    ? savedSettings.hidden.filter(isPrimaryToolKey)
    : [];

  return {
    order,
    hidden: Array.from(new Set(hidden))
  };
}

async function getSavedMenuSettings(): Promise<MenuSettings> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(MENU_SETTINGS_STORAGE_KEY);
    return normalizeMenuSettings(result[MENU_SETTINGS_STORAGE_KEY]);
  }

  const rawSettings = window.localStorage.getItem(MENU_SETTINGS_STORAGE_KEY);

  if (!rawSettings) {
    return defaultMenuSettings;
  }

  try {
    return normalizeMenuSettings(JSON.parse(rawSettings));
  } catch {
    return defaultMenuSettings;
  }
}

async function saveMenuSettings(settings: MenuSettings): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [MENU_SETTINGS_STORAGE_KEY]: settings });
    return;
  }

  window.localStorage.setItem(MENU_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function toDraft(formState: FormState): PasswordEntryDraft {
  return {
    displayName: formState.displayName,
    url: formState.url,
    username: formState.username,
    password: formState.password
  };
}

function isImportPayload(value: unknown): value is PasswordVaultExport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<PasswordVaultExport>;
  return payload.version === 1 && Array.isArray(payload.entries);
}

async function copyTextToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function isSameDomainSwitcherDraft(
  leftDraft: DomainSwitcherDraft,
  rightDraft: DomainSwitcherDraft
): boolean {
  return (
    leftDraft.onlineDomain.trim() === rightDraft.onlineDomain.trim() &&
    leftDraft.localDomain.trim() === rightDraft.localDomain.trim()
  );
}

function getActiveTabHost(tabInfo: ActiveTabInfo | null): string {
  if (!tabInfo?.url) {
    return "";
  }

  try {
    return new URL(tabInfo.url).host;
  } catch {
    return "";
  }
}

function createDefaultDomainSwitcherDraft(tabInfo: ActiveTabInfo | null): DomainSwitcherDraft {
  return {
    onlineDomain: getActiveTabHost(tabInfo),
    localDomain: DEFAULT_LOCAL_DOMAIN
  };
}

function toDomainSwitcherDraft(rule: DomainSwitcherRule): DomainSwitcherDraft {
  return {
    onlineDomain: rule.onlineDomain,
    localDomain: rule.localDomain
  };
}

function getVaultErrorMessage(error: unknown, t: (typeof messages)[Locale]): string {
  if (!(error instanceof PasswordVaultError)) {
    return "";
  }

  if (error.code === "DUPLICATE_ENTRY") {
    return t.duplicateAccount;
  }

  if (error.code === "INVALID_URL") {
    return t.invalidUrl;
  }

  return "";
}

function PopupApp() {
  const [locale, setLocale] = useState<Locale>(getDefaultLocale());
  const [activeTool, setActiveTool] = useState<ToolKey>("passwordManager");
  const [menuSettings, setMenuSettings] = useState<MenuSettings>(defaultMenuSettings);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTabInfo | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [domainSwitcherDraft, setDomainSwitcherDraft] =
    useState<DomainSwitcherDraft>(emptyDomainSwitcherDraft);
  const [domainSwitcherRules, setDomainSwitcherRules] = useState<DomainSwitcherRule[]>([]);
  const [cookieRequestUrl, setCookieRequestUrl] = useState("");
  const [capturedCookieHeader, setCapturedCookieHeader] = useState<CapturedCookieHeader | null>(null);
  const [selectedDomainRuleId, setSelectedDomainRuleId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [savedEntriesTab, setSavedEntriesTab] = useState<SavedEntriesTab>("otherSites");
  const [savedEntriesPage, setSavedEntriesPage] = useState(1);
  const [visiblePasswords, setVisiblePasswords] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const t = messages[locale];
  const isActionPending = pendingAction !== null || pendingDeleteId !== null;

  useEffect(() => {
    void getSavedLocale().then(setLocale);
    void getSavedActiveTool().then(setActiveTool);
    void getSavedMenuSettings().then(setMenuSettings);
    void getPasswordEntries().then(setEntries);
    void getDomainSwitcherRules().then((rules) => {
      setDomainSwitcherRules(rules);
    });
    void getCapturedCookieHeader().then(setCapturedCookieHeader);
    void getActiveTabInfo().then((tabInfo) => {
      setActiveTab(tabInfo);

      if (tabInfo?.url) {
        setFormState((currentFormState) => ({
          ...currentFormState,
          url: tabInfo.url
        }));
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setMessage("");
    }, 2000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [message]);

  const activeHostname = activeTab?.url ? getHostname(activeTab.url) : "";
  const hiddenMenuItems = useMemo(
    () => new Set(menuSettings.hidden),
    [menuSettings.hidden]
  );
  const visibleMenuTools = useMemo(
    () => menuSettings.order.filter((toolKey) => !hiddenMenuItems.has(toolKey)),
    [hiddenMenuItems, menuSettings.order]
  );

  useEffect(() => {
    if (activeTool === "settings") {
      return;
    }

    if (!hiddenMenuItems.has(activeTool)) {
      return;
    }

    const nextTool = visibleMenuTools[0] ?? "settings";
    setActiveTool(nextTool);
    void saveActiveTool(nextTool);
  }, [activeTool, hiddenMenuItems, visibleMenuTools]);

  useEffect(() => {
    if (activeTool !== "cookieViewer") {
      return;
    }

    if (!activeHostname) {
      setCookieRequestUrl("");
      setCapturedCookieHeader(null);
      return;
    }

    void getCookieCaptureRequestUrl(activeHostname).then((nextRequestUrl) => {
      setCookieRequestUrl(nextRequestUrl);
      void syncCapturedCookieHeader(nextRequestUrl, false, true);
    });
  }, [activeHostname, activeTool]);

  useEffect(() => {
    if (activeTool !== "cookieViewer" || !activeHostname || !cookieRequestUrl) {
      return;
    }

    return subscribeCapturedCookieHeaderChanges(() => {
      void syncCapturedCookieHeader(cookieRequestUrl, false, false);
    });
  }, [activeHostname, activeTool, cookieRequestUrl]);

  useEffect(() => {
    if (activeTool !== "cookieViewer" || !activeHostname || !cookieRequestUrl) {
      return;
    }

    const timerId = window.setInterval(() => {
      void syncCapturedCookieHeader(cookieRequestUrl, false, false);
    }, 500);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeHostname, activeTool, cookieRequestUrl]);

  const matchedEntries = useMemo(
    () =>
      activeHostname
        ? entries.filter((entry) => isSameOrSubdomain(activeHostname, entry.hostname))
        : [],
    [activeHostname, entries]
  );
  const otherSiteEntries = useMemo(
    () =>
      activeHostname
        ? entries.filter((entry) => !isSameOrSubdomain(activeHostname, entry.hostname))
        : entries,
    [activeHostname, entries]
  );
  const displayedSavedEntries = savedEntriesTab === "otherSites" ? otherSiteEntries : entries;
  const savedEntriesTotalPages = getTotalPages(displayedSavedEntries.length, PASSWORD_PAGE_SIZE);
  const paginatedSavedEntries = useMemo(() => {
    return getPaginatedItems(displayedSavedEntries, savedEntriesPage, PASSWORD_PAGE_SIZE);
  }, [displayedSavedEntries, savedEntriesPage]);

  useEffect(() => {
    setSavedEntriesPage((currentPage) => Math.min(currentPage, savedEntriesTotalPages));
  }, [savedEntriesTotalPages]);

  useEffect(() => {
    if (!activeTab?.url) {
      return;
    }

    const selectedRule = selectedDomainRuleId
      ? domainSwitcherRules.find((rule) => rule.id === selectedDomainRuleId)
      : null;

    if (selectedRule) {
      return;
    }

    const matchedRule = domainSwitcherRules.find((rule) =>
      buildSwitchedDomainUrl(activeTab.url, rule)
    );

    if (matchedRule) {
      setSelectedDomainRuleId(matchedRule.id);
      setDomainSwitcherDraft(toDomainSwitcherDraft(matchedRule));
      return;
    }

    setDomainSwitcherDraft((currentDraft) => {
      if (currentDraft.onlineDomain.trim() || currentDraft.localDomain.trim()) {
        return currentDraft;
      }

      return createDefaultDomainSwitcherDraft(activeTab);
    });
  }, [activeTab, domainSwitcherRules, selectedDomainRuleId]);

  const handleInputChange =
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((currentFormState) => ({
        ...currentFormState,
        [field]: event.target.value
      }));
    };

  const handleDomainSwitcherInputChange =
    (field: keyof DomainSwitcherDraft) => (event: ChangeEvent<HTMLInputElement>) => {
      setDomainSwitcherDraft((currentConfig) => ({
        ...currentConfig,
        [field]: event.target.value
      }));
    };

  const handleCookieRequestUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCookieRequestUrl(event.target.value);
  };

  const resetForm = () => {
    setEditingId(null);
    setIsFormOpen(false);
    setFormState({
      ...emptyForm,
      url: activeTab?.url ?? ""
    });
  };

  const handleAdd = () => {
    setEditingId(null);
    setIsFormOpen(true);
    setFormState({
      ...emptyForm,
      url: activeTab?.url ?? ""
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingAction === "save") {
      return;
    }

    if (!formState.displayName.trim() || !formState.url.trim() || !formState.username.trim()) {
      setMessage(t.validationRequired);
      return;
    }

    setPendingAction("save");

    try {
      const isEditing = Boolean(editingId);
      const nextEntries = await savePasswordEntry(toDraft(formState), editingId ?? undefined);
      setEntries(nextEntries);
      setMessage(isEditing ? t.updated : t.saved);
      if (!isEditing) {
        setSavedEntriesPage(1);
      }
      resetForm();
    } catch (error) {
      setMessage(getVaultErrorMessage(error, t) || t.failedSave);
    } finally {
      setPendingAction(null);
    }
  };

  const handleEdit = (entry: PasswordEntry) => {
    setEditingId(entry.id);
    setIsFormOpen(true);
    setFormState({
      displayName: entry.displayName,
      url: entry.url,
      username: entry.username,
      password: entry.password
    });
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleDelete = async (entry: PasswordEntry) => {
    if (pendingDeleteId) {
      return;
    }

    if (!window.confirm(t.deleteConfirm(entry.displayName))) {
      return;
    }

    setPendingDeleteId(entry.id);

    try {
      const nextEntries = await deletePasswordEntry(entry.id);
      setEntries(nextEntries);
      setMessage(t.deleted);

      if (editingId === entry.id) {
        resetForm();
      }
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleExport = () => {
    if (pendingAction === "export") {
      return;
    }

    setPendingAction("export");
    const payload = createPasswordVaultExport(entries);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `toolbooox-passwords-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    setMessage(t.exported);
    setPendingAction(null);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (pendingAction === "import") {
      return;
    }

    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!file) {
      return;
    }

    setPendingAction("import");

    try {
      const parsedValue: unknown = JSON.parse(await file.text());

      if (!isImportPayload(parsedValue)) {
        setMessage(t.invalidImport);
        return;
      }

      const nextEntries = await replacePasswordEntries(parsedValue.entries);
      setEntries(nextEntries);
      setSavedEntriesPage(1);
      setMessage(t.imported);
      resetForm();
    } catch (error) {
      setMessage(getVaultErrorMessage(error, t) || t.failedImport);
    } finally {
      setPendingAction(null);
    }
  };

  const handleLocaleChange = async (nextLocale: Locale) => {
    setLocale(nextLocale);
    setMessage("");
    await saveLocale(nextLocale);
  };

  const handleToolChange = async (nextTool: ToolKey) => {
    setActiveTool(nextTool);
    setMessage("");
    await saveActiveTool(nextTool);
  };

  const getPrimaryToolLabel = (toolKey: PrimaryToolKey): string => {
    switch (toolKey) {
      case "passwordManager":
        return t.passwordManager;
      case "domainSwitcher":
        return t.domainSwitcher;
      case "cookieViewer":
        return t.cookieViewer;
    }
  };

  const updateMenuSettings = (nextSettings: MenuSettings) => {
    setMenuSettings(nextSettings);
    void saveMenuSettings(nextSettings);
  };

  const handleToggleMenuItem = (toolKey: PrimaryToolKey) => {
    const hiddenSet = new Set(menuSettings.hidden);

    if (hiddenSet.has(toolKey)) {
      hiddenSet.delete(toolKey);
    } else {
      hiddenSet.add(toolKey);
    }

    updateMenuSettings({
      ...menuSettings,
      hidden: Array.from(hiddenSet)
    });
  };

  const handleMoveMenuItem = (toolKey: PrimaryToolKey, direction: -1 | 1) => {
    const currentIndex = menuSettings.order.indexOf(toolKey);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= menuSettings.order.length) {
      return;
    }

    const nextOrder = [...menuSettings.order];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex]
    ];

    updateMenuSettings({
      ...menuSettings,
      order: nextOrder
    });
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((currentVisiblePasswords) => {
      const nextVisiblePasswords = new Set(currentVisiblePasswords);

      if (nextVisiblePasswords.has(id)) {
        nextVisiblePasswords.delete(id);
      } else {
        nextVisiblePasswords.add(id);
      }

      return nextVisiblePasswords;
    });
  };

  const handleCopy = async (text: string, successMessage: string) => {
    try {
      await copyTextToClipboard(text);
      setMessage(successMessage);
    } catch {
      setMessage(t.copyFailed);
    }
  };

  const handleClearCookieViewer = async () => {
    setCapturedCookieHeader(null);
    await clearCapturedCookieHeader();
    setMessage(t.cookiesCleared);
  };

  async function syncCapturedCookieHeader(
    requestUrl: string,
    shouldShowMessage: boolean,
    allowFallback: boolean
  ) {
    const nextCapturedHeader = await getCapturedCookieHeader();
    const matchedCapturedHeader =
      nextCapturedHeader &&
      nextCapturedHeader.pageHostname === activeHostname &&
      doesRequestMatchCookieCaptureUrl(nextCapturedHeader.matchedUrl, requestUrl)
        ? nextCapturedHeader
        : null;

    if (matchedCapturedHeader?.cookieHeader) {
      setCapturedCookieHeader(matchedCapturedHeader);
      if (shouldShowMessage) {
        setMessage(t.requestCookieCaptured);
      }
      return;
    }

    if (!allowFallback) {
      return;
    }

    try {
      const cookiesForRequestUrl = requestUrl ? await getCookiesForUrl(requestUrl) : [];
      const cookieHeader = formatCookieHeader(cookiesForRequestUrl);
      const fallbackCapturedHeader = cookieHeader
        ? {
            pageHostname: activeHostname,
            requestUrl,
            matchedUrl: requestUrl,
            method: "GET",
            cookieHeader,
            capturedAt: new Date().toISOString()
          }
        : null;

      setCapturedCookieHeader(fallbackCapturedHeader);
      if (shouldShowMessage) {
        setMessage(fallbackCapturedHeader ? t.requestCookieCaptured : t.requestCookieEmpty);
      }
    } catch {
      setCapturedCookieHeader(null);
      if (shouldShowMessage) {
        setMessage(t.requestCookieEmpty);
      }
    }
  }

  const handleRefreshCapturedCookieHeader = async () => {
    await syncCapturedCookieHeader(cookieRequestUrl, true, true);
  };

  const handleSaveCookieRequestUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingAction === "saveCookieRequestUrl") {
      return;
    }

    setPendingAction("saveCookieRequestUrl");

    try {
      const savedRequestUrl = await saveCookieCaptureRequestUrl(cookieRequestUrl, activeHostname);
      setCookieRequestUrl(savedRequestUrl);
      setCapturedCookieHeader(null);
      await clearCapturedCookieHeader();
      setMessage(t.requestUrlSaved);
    } catch {
      setMessage(t.invalidRequestUrl);
    } finally {
      setPendingAction(null);
    }
  };

  const handleSavedEntriesTabChange = (nextTab: SavedEntriesTab) => {
    setSavedEntriesTab(nextTab);
    setSavedEntriesPage(1);
  };

  const handleSelectDomainRule = (rule: DomainSwitcherRule) => {
    setSelectedDomainRuleId(rule.id);
    setDomainSwitcherDraft(toDomainSwitcherDraft(rule));
    setMessage("");
  };

  const handleSaveDomainRule = async () => {
    if (pendingAction === "saveDomainRule") {
      return;
    }

    if (!domainSwitcherDraft.onlineDomain.trim() || !domainSwitcherDraft.localDomain.trim()) {
      setMessage(t.domainSwitcherRequired);
      return;
    }

    if (!isValidDomainSwitcherDraft(domainSwitcherDraft)) {
      setMessage(t.domainSwitcherInvalid);
      return;
    }

    setPendingAction("saveDomainRule");

    try {
      const result = await saveDomainSwitcherRule(
        domainSwitcherRules,
        domainSwitcherDraft,
        selectedDomainRuleId
      );
      setDomainSwitcherRules(result.rules);
      setSelectedDomainRuleId(result.savedRule.id);
      setDomainSwitcherDraft({
        onlineDomain: result.savedRule.onlineDomain,
        localDomain: result.savedRule.localDomain
      });
      setMessage(t.domainRuleSaved);
    } catch {
      setMessage(t.domainRuleSaveFailed);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteDomainRule = async (rule: DomainSwitcherRule) => {
    if (!window.confirm(t.domainRuleDeleteConfirm(rule.onlineDomain, rule.localDomain))) {
      return;
    }

    const nextRules = await deleteDomainSwitcherRule(domainSwitcherRules, rule.id);
    setDomainSwitcherRules(nextRules);

    if (selectedDomainRuleId === rule.id) {
      const [nextRule] = nextRules;
      setSelectedDomainRuleId(nextRule?.id ?? null);
      setDomainSwitcherDraft(
        nextRule
          ? {
              onlineDomain: nextRule.onlineDomain,
              localDomain: nextRule.localDomain
            }
          : emptyDomainSwitcherDraft
      );
    }

    setMessage(t.domainRuleDeleted);
  };

  const handleSwitchDomain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingAction === "switchDomain") {
      return;
    }

    if (!activeTab?.url) {
      setMessage(t.noActiveSite);
      return;
    }

    const hasDraftInput =
      Boolean(domainSwitcherDraft.onlineDomain.trim()) ||
      Boolean(domainSwitcherDraft.localDomain.trim());
    const hasCompleteDraft =
      Boolean(domainSwitcherDraft.onlineDomain.trim()) &&
      Boolean(domainSwitcherDraft.localDomain.trim());

    if (hasDraftInput && !hasCompleteDraft) {
      setMessage(t.domainSwitcherRequired);
      return;
    }

    if (hasCompleteDraft && !isValidDomainSwitcherDraft(domainSwitcherDraft)) {
      setMessage(t.domainSwitcherInvalid);
      return;
    }

    if (!hasCompleteDraft && domainSwitcherRules.length === 0) {
      setMessage(t.domainSwitcherRequired);
      return;
    }

    setPendingAction("switchDomain");

    try {
      const candidates = [
        ...(hasCompleteDraft ? [{ draft: domainSwitcherDraft, rule: null }] : []),
        ...domainSwitcherRules
          .filter((rule) => !isSameDomainSwitcherDraft(rule, domainSwitcherDraft))
          .map((rule) => ({ draft: rule, rule }))
      ];
      const matchedCandidate = candidates
        .map((candidate) => ({
          ...candidate,
          switchResult: buildSwitchedDomainUrl(activeTab.url, candidate.draft)
        }))
        .find((candidate) => candidate.switchResult);

      if (!matchedCandidate?.switchResult) {
        setMessage(t.domainSwitcherNoMatch);
        return;
      }

      if (matchedCandidate.rule) {
        setSelectedDomainRuleId(matchedCandidate.rule.id);
        setDomainSwitcherDraft({
          onlineDomain: matchedCandidate.rule.onlineDomain,
          localDomain: matchedCandidate.rule.localDomain
        });
      }

      await updateActiveTabUrl(activeTab.id, matchedCandidate.switchResult.nextUrl);
      setActiveTab({
        ...activeTab,
        title: matchedCandidate.switchResult.nextUrl,
        url: matchedCandidate.switchResult.nextUrl
      });
      setMessage(
        matchedCandidate.switchResult.source === "online"
          ? t.domainSwitcherSwitchedToLocal
          : t.domainSwitcherSwitchedToOnline
      );
    } catch {
      setMessage(t.domainSwitcherFailed);
    } finally {
      setPendingAction(null);
    }
  };

  const currentDomainSwitchResult = activeTab?.url
    ? buildSwitchedDomainUrl(activeTab.url, domainSwitcherDraft)
    : null;
  const visibleCapturedCookieHeader =
    capturedCookieHeader &&
    capturedCookieHeader.pageHostname === activeHostname &&
    doesRequestMatchCookieCaptureUrl(capturedCookieHeader.matchedUrl, cookieRequestUrl)
      ? capturedCookieHeader
      : null;
  const requestCookies = parseCookieHeader(visibleCapturedCookieHeader?.cookieHeader ?? "");
  const switchDomainButtonLabel =
    currentDomainSwitchResult?.source === "online"
      ? t.switchToLocalDomain
      : currentDomainSwitchResult?.source === "local"
        ? t.switchToOnlineDomain
        : t.switchDomain;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Toolbooox</h1>
        </div>
        <div className="language-links" aria-label={t.language}>
          <button
            aria-current={locale === "zh-CN" ? "true" : undefined}
            type="button"
            onClick={() => handleLocaleChange("zh-CN")}
          >
            中文
          </button>
          <span>|</span>
          <button
            aria-current={locale === "en" ? "true" : undefined}
            type="button"
            onClick={() => handleLocaleChange("en")}
          >
            English
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar" aria-label={t.menu}>
          <div className="sidebar-menu">
            {visibleMenuTools.map((toolKey) => (
              <button
                aria-current={activeTool === toolKey ? "page" : undefined}
                className="menu-item"
                key={toolKey}
                type="button"
                onClick={() => handleToolChange(toolKey)}
              >
                {getPrimaryToolLabel(toolKey)}
              </button>
            ))}
          </div>
          <button
            aria-current={activeTool === "settings" ? "page" : undefined}
            aria-label={t.settings}
            className="settings-menu-button"
            title={t.settings}
            type="button"
            onClick={() => handleToolChange("settings")}
          >
            <svg
              aria-hidden="true"
              className="settings-icon"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2.06 2.06 0 0 1-2.91 2.91l-.04-.04a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2.06 2.06 0 0 1-4.12 0v-.06a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.04.04a2.06 2.06 0 0 1-2.91-2.91l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2.06 2.06 0 0 1 0-4.12h.06A1.7 1.7 0 0 0 4.6 8.82a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2.06 2.06 0 0 1 2.91-2.91l.04.04a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10.08 2.8V3a2.06 2.06 0 0 1 4.12 0v-.06a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.04-.04a2.06 2.06 0 0 1 2.91 2.91l-.04.04a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21a2.06 2.06 0 0 1 0 4.12h-.06A1.7 1.7 0 0 0 19.4 15Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </aside>

        <main className="feature-main">
          {message ? <p className="toast" role="status">{message}</p> : null}

          {activeTool === "passwordManager" ? (
            <section className="feature-panel" aria-label={t.passwordManager}>
              <div className="feature-header">
                <div>
                  <p className="eyebrow">{t.localPasswordManager}</p>
                  <h2>{t.passwordManager}</h2>
                </div>

                <div className="feature-actions">
                  <button
                    className="primary-action"
                    disabled={isActionPending}
                    type="button"
                    onClick={handleAdd}
                  >
                    {t.add}
                  </button>
                  <button
                    className="text-button"
                    disabled={entries.length === 0 || isActionPending}
                    type="button"
                    onClick={handleExport}
                  >
                    {t.export}
                  </button>
                  <label
                    className="import-button"
                    aria-disabled={isActionPending ? "true" : undefined}
                  >
                    {t.import}
                    <input
                      accept="application/json"
                      disabled={isActionPending}
                      type="file"
                      onChange={handleImport}
                    />
                  </label>
                </div>
              </div>

            <section className="current-site" aria-label={t.currentSite}>
              <div>
                <p className="section-label">{t.currentSite}</p>
                <h3>
                  {activeTab?.url
                    ? `${activeTab.title || activeHostname}（${activeHostname}）`
                    : t.noActiveSite}
                </h3>
                {activeTab?.url ? null : <p>{t.noActiveSiteHelp}</p>}
              </div>
              <span className="counter">{matchedEntries.length}</span>
            </section>

            {isFormOpen ? (
              <form ref={formRef} className="password-form" onSubmit={handleSubmit}>
                <div className="section-heading">
                  <h3>{editingId ? t.editPassword : t.addPassword}</h3>
                  <button
                    className="text-button"
                    disabled={pendingAction === "save"}
                    type="button"
                    onClick={resetForm}
                  >
                    {t.cancel}
                  </button>
                </div>
                <label>
                  {t.displayName}
                  <input
                    autoComplete="off"
                    placeholder={t.displayNamePlaceholder}
                    required
                    value={formState.displayName}
                    onChange={handleInputChange("displayName")}
                  />
                </label>
                <label>
                  {t.url}
                  <input
                    autoComplete="url"
                    inputMode="url"
                    required
                    value={formState.url}
                    onChange={handleInputChange("url")}
                  />
                </label>
                <label>
                  {t.account}
                  <input
                    autoComplete="username"
                    placeholder={t.usernamePlaceholder}
                    required
                    value={formState.username}
                    onChange={handleInputChange("username")}
                  />
                </label>
                <label>
                  {t.password}
                  <input
                    autoComplete="current-password"
                    placeholder={t.passwordPlaceholder}
                    required
                    type="password"
                    value={formState.password}
                    onChange={handleInputChange("password")}
                  />
                </label>
                <button className="primary-button" disabled={pendingAction === "save"} type="submit">
                  {editingId ? t.saveChanges : t.save}
                </button>
              </form>
            ) : null}

            <section className="entry-list" aria-label={t.matchedAccounts}>
              <div className="section-heading">
                <h3>{t.matchedAccounts}</h3>
              </div>
              {matchedEntries.length > 0 ? (
                <PasswordEntryTable
                  entries={matchedEntries}
                  isPasswordVisible={(id) => visiblePasswords.has(id)}
                  isActionDisabled={isActionPending}
                  pendingDeleteId={pendingDeleteId}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onTogglePassword={togglePasswordVisibility}
                  t={t}
                />
              ) : (
                <div className="empty-state">
                  <p>{t.noMatch}</p>
                  <button
                    className="text-button"
                    disabled={isActionPending}
                    type="button"
                    onClick={handleAdd}
                  >
                    {t.saveAccount}
                  </button>
                </div>
              )}
            </section>

            <section className="entry-list" aria-label={t.savedAccounts}>
              <div className="section-heading">
                <h3>{t.savedAccounts}</h3>
              </div>
              <div className="tabbar" role="tablist" aria-label={t.savedAccounts}>
                <button
                  aria-selected={savedEntriesTab === "all"}
                  role="tab"
                  type="button"
                  onClick={() => handleSavedEntriesTabChange("all")}
                >
                  {t.all}
                </button>
                <button
                  aria-selected={savedEntriesTab === "otherSites"}
                  role="tab"
                  type="button"
                  onClick={() => handleSavedEntriesTabChange("otherSites")}
                >
                  {t.otherSites}
                </button>
              </div>
              {displayedSavedEntries.length > 0 ? (
                <PasswordEntryTable
                  entries={paginatedSavedEntries}
                  isPasswordVisible={(id) => visiblePasswords.has(id)}
                  isActionDisabled={isActionPending}
                  pendingDeleteId={pendingDeleteId}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onTogglePassword={togglePasswordVisibility}
                  t={t}
                />
              ) : null}
              {displayedSavedEntries.length === 0 ? (
                <div className="empty-state">
                  <p>{savedEntriesTab === "otherSites" ? t.noOtherSitePasswords : t.noPasswords}</p>
                  <button
                    className="text-button"
                    disabled={isActionPending}
                    type="button"
                    onClick={handleAdd}
                  >
                    {t.addFirstAccount}
                  </button>
                </div>
              ) : null}
              {savedEntriesTotalPages > 1 ? (
                <div className="pagination" aria-label={t.savedAccounts}>
                  <button
                    className="text-button"
                    disabled={savedEntriesPage === 1}
                    type="button"
                    onClick={() => setSavedEntriesPage((currentPage) => Math.max(1, currentPage - 1))}
                  >
                    {t.previousPage}
                  </button>
                  <span>{t.pageStatus(savedEntriesPage, savedEntriesTotalPages)}</span>
                  <button
                    className="text-button"
                    disabled={savedEntriesPage === savedEntriesTotalPages}
                    type="button"
                    onClick={() =>
                      setSavedEntriesPage((currentPage) =>
                        Math.min(savedEntriesTotalPages, currentPage + 1)
                      )
                    }
                  >
                    {t.nextPage}
                  </button>
                </div>
              ) : null}
            </section>
          </section>
          ) : activeTool === "domainSwitcher" ? (
          <section className="feature-panel" aria-label={t.domainSwitcher}>
            <div className="feature-header">
              <div>
                <p className="eyebrow">{t.frontendDeveloperTools}</p>
                <h2>{t.domainSwitcher}</h2>
              </div>
            </div>

            <section className="current-site" aria-label={t.currentSite}>
              <div>
                <p className="section-label">{t.currentSite}</p>
                <h3>
                  {activeTab?.url
                    ? `${activeTab.title || activeHostname}（${activeHostname}）`
                    : t.noActiveSite}
                </h3>
                {activeTab?.url ? <p>{activeTab.url}</p> : <p>{t.noActiveSiteHelp}</p>}
              </div>
            </section>

            <form className="developer-form" onSubmit={handleSwitchDomain}>
              <div className="section-heading">
                <h3>{t.domainSwitcher}</h3>
              </div>
              <div className="domain-grid">
                <label>
                  {t.onlineDomain}
                  <input
                    autoComplete="off"
                    inputMode="url"
                    placeholder={t.onlineDomainPlaceholder}
                    required
                    value={domainSwitcherDraft.onlineDomain}
                    onChange={handleDomainSwitcherInputChange("onlineDomain")}
                  />
                </label>
                <label>
                  {t.localDomain}
                  <input
                    autoComplete="off"
                    inputMode="url"
                    placeholder={t.localDomainPlaceholder}
                    required
                    value={domainSwitcherDraft.localDomain}
                    onChange={handleDomainSwitcherInputChange("localDomain")}
                  />
                </label>
              </div>
              <div className="developer-form-actions">
                <button
                  className="text-button"
                  disabled={pendingAction === "saveDomainRule"}
                  type="button"
                  onClick={handleSaveDomainRule}
                >
                  {t.saveDomainRule}
                </button>
                <button
                  className="primary-button"
                  disabled={pendingAction === "switchDomain"}
                  type="submit"
                >
                  {switchDomainButtonLabel}
                </button>
              </div>
            </form>

            <section className="entry-list" aria-label={t.savedDomainRules}>
              <div className="section-heading">
                <h3>{t.savedDomainRules}</h3>
              </div>
              {domainSwitcherRules.length > 0 ? (
                <div className="domain-rule-list" role="list">
                  <div className="domain-rule-header" aria-hidden="true">
                    <span>{t.onlineDomain}</span>
                    <span>{t.localDomain}</span>
                    <span>{t.actions}</span>
                  </div>
                  {domainSwitcherRules.map((rule) => (
                    <article className="domain-rule-item" key={rule.id} role="listitem">
                      <span className="domain-rule-value" title={rule.onlineDomain}>
                        {rule.onlineDomain}
                      </span>
                      <span className="domain-rule-value" title={rule.localDomain}>
                        {rule.localDomain}
                      </span>
                      <div className="row-actions">
                        {selectedDomainRuleId === rule.id ? (
                          <span className="selected-label">{t.selected}</span>
                        ) : (
                          <button type="button" onClick={() => handleSelectDomainRule(rule)}>
                            {t.select}
                          </button>
                        )}
                        <button type="button" onClick={() => handleDeleteDomainRule(rule)}>
                          {t.delete}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>{t.noDomainRules}</p>
                </div>
              )}
            </section>
          </section>
          ) : activeTool === "settings" ? (
          <section className="feature-panel" aria-label={t.settings}>
            <div className="feature-header">
              <div>
                <h2>{t.settings}</h2>
                <p className="version-label">{t.version}: {manifest.version}</p>
              </div>
            </div>

            <section className="developer-form" aria-label={t.menuSettings}>
              <div className="section-heading">
                <h3>{t.menuSettings}</h3>
              </div>
              <p className="tool-note">{t.menuSettingsHelp}</p>
              <div className="menu-settings-list" role="list">
                {menuSettings.order.map((toolKey, index) => {
                  const isHidden = hiddenMenuItems.has(toolKey);

                  return (
                    <article className="menu-settings-row" key={toolKey} role="listitem">
                      <label className="menu-visibility-toggle">
                        <input
                          checked={!isHidden}
                          type="checkbox"
                          onChange={() => handleToggleMenuItem(toolKey)}
                        />
                        <span>{getPrimaryToolLabel(toolKey)}</span>
                      </label>
                      <div className="menu-order-actions" aria-label={t.menuOrder}>
                        <button
                          aria-label={t.moveUp}
                          disabled={index === 0}
                          title={t.moveUp}
                          type="button"
                          onClick={() => handleMoveMenuItem(toolKey, -1)}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={t.moveDown}
                          disabled={index === menuSettings.order.length - 1}
                          title={t.moveDown}
                          type="button"
                          onClick={() => handleMoveMenuItem(toolKey, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
          ) : (
          <section className="feature-panel" aria-label={t.cookieViewer}>
            <div className="feature-header">
              <div>
                <p className="eyebrow">{t.frontendDeveloperTools}</p>
                <h2>{t.cookieViewer}</h2>
              </div>
              <div className="feature-actions">
                <button
                  className="primary-action"
                  disabled={!visibleCapturedCookieHeader?.cookieHeader}
                  type="button"
                  onClick={() => handleCopy(visibleCapturedCookieHeader?.cookieHeader ?? "", t.cookiesCopied)}
                >
                  {t.copyAll}
                </button>
              </div>
            </div>

            <section className="current-site" aria-label={t.currentSite}>
              <div>
                <p className="section-label">{t.currentSite}</p>
                <h3>
                  {activeTab?.url
                    ? `${activeTab.title || activeHostname}（${activeHostname}）`
                    : t.noActiveSite}
                </h3>
                {activeTab?.url ? <p>{activeTab.url}</p> : <p>{t.noActiveSiteHelp}</p>}
              </div>
            </section>

            <section className="developer-form" aria-label={t.cookieViewer}>
              <div className="section-heading">
                <h3>{t.requestCookieHeader}</h3>
              </div>
              <p className="tool-note">{t.requestCookieHeaderHelp}</p>
              <form className="cookie-request-form" onSubmit={handleSaveCookieRequestUrl}>
                <label>
                  {t.requestUrl}
                  <input
                    autoComplete="off"
                    inputMode="url"
                    placeholder={t.requestUrlPlaceholder}
                    required
                    value={cookieRequestUrl}
                    onChange={handleCookieRequestUrlChange}
                  />
                </label>
                <div className="developer-form-actions">
                  <button
                    className="primary-button"
                    disabled={pendingAction === "saveCookieRequestUrl"}
                    type="submit"
                  >
                    {t.saveRequestUrl}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={handleRefreshCapturedCookieHeader}
                  >
                    {t.refresh}
                  </button>
                  <button
                    className="text-button"
                    disabled={!visibleCapturedCookieHeader?.cookieHeader}
                    type="button"
                    onClick={() => handleCopy(visibleCapturedCookieHeader?.cookieHeader ?? "", t.cookiesCopied)}
                  >
                    {t.copy}
                  </button>
                </div>
              </form>
              <textarea
                className="cookie-header-output"
                readOnly
                placeholder={t.requestCookieEmpty}
                value={visibleCapturedCookieHeader?.cookieHeader ?? ""}
              />
              {visibleCapturedCookieHeader ? (
                <p className="tool-note">
                  {t.lastCapturedRequest(
                    visibleCapturedCookieHeader.method,
                    visibleCapturedCookieHeader.matchedUrl
                  )}
                </p>
              ) : null}
              <p className="tool-note">{t.cookieViewerPrivacy}</p>
            </section>

            <section className="entry-list" aria-label={t.cookieViewer}>
              <div className="section-heading">
                <h3>{t.cookieList}</h3>
                <div className="section-actions">
                  <span className="counter">{requestCookies.length}</span>
                  <button
                    className="text-button"
                    disabled={!visibleCapturedCookieHeader}
                    type="button"
                    onClick={handleClearCookieViewer}
                  >
                    {t.clear}
                  </button>
                </div>
              </div>
              {requestCookies.length > 0 ? (
                <div className="cookie-table" role="list">
                  <div className="cookie-table-header" aria-hidden="true">
                    <span>{t.cookieName}</span>
                    <span>{t.cookieValue}</span>
                    <span>{t.actions}</span>
                  </div>
                  {requestCookies.map((cookie) => (
                    <article
                      className="cookie-row"
                      key={cookie.name}
                      role="listitem"
                    >
                      <span className="cookie-cell" title={cookie.name}>{cookie.name}</span>
                      <span className="cookie-cell" title={cookie.value}>{cookie.value}</span>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => handleCopy(`${cookie.name}=${cookie.value}`, t.cookieCopied)}
                        >
                          {t.copy}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>{t.noCookies}</p>
                </div>
              )}
            </section>
          </section>
          )}
        </main>
      </div>
    </div>
  );
}

type PasswordEntryTableProps = {
  readonly entries: readonly PasswordEntry[];
  readonly isPasswordVisible: (id: string) => boolean;
  readonly isActionDisabled: boolean;
  readonly pendingDeleteId: string | null;
  readonly onCopy: (text: string, successMessage: string) => void;
  readonly onDelete: (entry: PasswordEntry) => void;
  readonly onEdit: (entry: PasswordEntry) => void;
  readonly onTogglePassword: (id: string) => void;
  readonly t: (typeof messages)[Locale];
};

function PasswordEntryTable({
  entries,
  isPasswordVisible,
  isActionDisabled,
  pendingDeleteId,
  onCopy,
  onDelete,
  onEdit,
  onTogglePassword,
  t
}: PasswordEntryTableProps) {
  return (
    <div className="password-table" role="list">
      <div className="password-table-header" aria-hidden="true">
        <span>{t.displayName}</span>
        <span>{t.account}</span>
        <span>{t.password}</span>
        <span>{t.actions}</span>
      </div>
      {entries.map((entry) => (
        <PasswordEntryRow
          entry={entry}
          isPasswordVisible={isPasswordVisible(entry.id)}
          isActionDisabled={isActionDisabled}
          key={entry.id}
          pendingDeleteId={pendingDeleteId}
          onCopy={onCopy}
          onDelete={onDelete}
          onEdit={onEdit}
          onTogglePassword={onTogglePassword}
          t={t}
        />
      ))}
    </div>
  );
}

type PasswordEntryRowProps = {
  readonly entry: PasswordEntry;
  readonly isPasswordVisible: boolean;
  readonly isActionDisabled: boolean;
  readonly pendingDeleteId: string | null;
  readonly onCopy: (text: string, successMessage: string) => void;
  readonly onDelete: (entry: PasswordEntry) => void;
  readonly onEdit: (entry: PasswordEntry) => void;
  readonly onTogglePassword: (id: string) => void;
  readonly t: (typeof messages)[Locale];
};

function PasswordEntryRow({
  entry,
  isPasswordVisible,
  isActionDisabled,
  pendingDeleteId,
  onCopy,
  onDelete,
  onEdit,
  onTogglePassword,
  t
}: PasswordEntryRowProps) {
  return (
    <article className="password-row" role="listitem">
      <div className="password-entry-identity">
        <strong title={entry.displayName}>{entry.displayName}</strong>
        <span title={entry.hostname}>{entry.hostname}</span>
      </div>
      <div className="credential-cell">
        <span title={entry.username}>{entry.username}</span>
        <button
          disabled={isActionDisabled}
          type="button"
          onClick={() => onCopy(entry.username, t.accountCopied)}
        >
          {t.copy}
        </button>
      </div>
      <div className="credential-cell">
        <span title={isPasswordVisible ? entry.password : undefined}>
          {isPasswordVisible ? entry.password : "********"}
        </span>
        <button disabled={isActionDisabled} type="button" onClick={() => onTogglePassword(entry.id)}>
          {isPasswordVisible ? t.hide : t.show}
        </button>
        <button
          disabled={isActionDisabled}
          type="button"
          onClick={() => onCopy(entry.password, t.passwordCopied)}
        >
          {t.copy}
        </button>
      </div>
      <div className="row-actions">
        <button disabled={isActionDisabled} type="button" onClick={() => onEdit(entry)}>
          {t.edit}
        </button>
        <button
          disabled={isActionDisabled || pendingDeleteId === entry.id}
          type="button"
          onClick={() => onDelete(entry)}
        >
          {t.delete}
        </button>
      </div>
    </article>
  );
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

createRoot(app).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);
