import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { getActiveTabInfo, type ActiveTabInfo } from "../shared/chrome/tabs";
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
import "./styles.css";

type FormState = {
  readonly displayName: string;
  readonly url: string;
  readonly username: string;
  readonly password: string;
};

type ToolKey = "passwordManager";
type SavedEntriesTab = "otherSites" | "all";
type PendingAction = "save" | "import" | "export" | null;

const emptyForm: FormState = {
  displayName: "",
  url: "",
  username: "",
  password: ""
};

const PASSWORD_PAGE_SIZE = 10;

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
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTabInfo | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
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
    void getPasswordEntries().then(setEntries);
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

  const handleInputChange =
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((currentFormState) => ({
        ...currentFormState,
        [field]: event.target.value
      }));
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

  const handleSavedEntriesTabChange = (nextTab: SavedEntriesTab) => {
    setSavedEntriesTab(nextTab);
    setSavedEntriesPage(1);
  };

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
          <button
            aria-current={activeTool === "passwordManager" ? "page" : undefined}
            className="menu-item"
            type="button"
            onClick={() => setActiveTool("passwordManager")}
          >
            {t.passwordManager}
          </button>
        </aside>

        <main className="feature-main">
          {message ? <p className="toast" role="status">{message}</p> : null}

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
                <label className="import-button" aria-disabled={isActionPending ? "true" : undefined}>
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
