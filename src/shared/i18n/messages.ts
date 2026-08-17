import type { Locale } from "./locale";

type Messages = {
  readonly account: string;
  readonly add: string;
  readonly addFirstAccount: string;
  readonly addPassword: string;
  readonly cancel: string;
  readonly accountCopied: string;
  readonly actions: string;
  readonly all: string;
  readonly copy: string;
  readonly copyFailed: string;
  readonly currentSite: string;
  readonly delete: string;
  readonly deleteConfirm: (displayName: string) => string;
  readonly deleted: string;
  readonly displayName: string;
  readonly displayNamePlaceholder: string;
  readonly edit: string;
  readonly editPassword: string;
  readonly export: string;
  readonly exported: string;
  readonly failedImport: string;
  readonly hide: string;
  readonly import: string;
  readonly imported: string;
  readonly invalidImport: string;
  readonly language: string;
  readonly localPasswordManager: string;
  readonly menu: string;
  readonly matchedAccounts: string;
  readonly nextPage: string;
  readonly noActiveSite: string;
  readonly noActiveSiteHelp: string;
  readonly noMatch: string;
  readonly noPasswords: string;
  readonly noOtherSitePasswords: string;
  readonly otherSites: string;
  readonly pageStatus: (currentPage: number, totalPages: number) => string;
  readonly password: string;
  readonly passwordCopied: string;
  readonly passwordManager: string;
  readonly passwordPlaceholder: string;
  readonly previousPage: string;
  readonly saveAccount: string;
  readonly save: string;
  readonly saveChanges: string;
  readonly saved: string;
  readonly savedAccounts: string;
  readonly show: string;
  readonly updated: string;
  readonly url: string;
  readonly usernamePlaceholder: string;
  readonly validationRequired: string;
};

export const messages: Record<Locale, Messages> = {
  "zh-CN": {
    account: "账号",
    add: "新增",
    addFirstAccount: "新增第一个账号",
    addPassword: "新增密码",
    cancel: "取消",
    accountCopied: "账号已复制。",
    actions: "操作",
    all: "全部",
    copy: "复制",
    copyFailed: "复制失败，请手动复制。",
    currentSite: "当前网站",
    delete: "删除",
    deleteConfirm: (displayName) => `确定删除「${displayName}」的密码吗？`,
    deleted: "密码已从本地删除。",
    displayName: "显示名称",
    displayNamePlaceholder: "方便区分这是账号名",
    edit: "编辑",
    editPassword: "编辑密码",
    export: "导出",
    exported: "密码库已导出。",
    failedImport: "密码库导入失败。",
    hide: "隐藏",
    import: "导入",
    imported: "密码库已导入本地。",
    invalidImport: "导入文件格式无效。",
    language: "语言",
    localPasswordManager: "本地密码管理器",
    menu: "菜单",
    matchedAccounts: "匹配账号",
    nextPage: "下一页",
    noActiveSite: "未检测到当前网站",
    noActiveSiteHelp: "在网站页面打开插件后，会自动匹配已保存账号。",
    noMatch: "当前网站没有匹配账号。",
    noPasswords: "还没有保存密码。",
    noOtherSitePasswords: "没有其他网站账号。",
    otherSites: "其他网站",
    pageStatus: (currentPage, totalPages) => `${currentPage} / ${totalPages}`,
    password: "密码",
    passwordCopied: "密码已复制。",
    passwordManager: "密码管理器",
    passwordPlaceholder: "密码存在你的电脑上，并不会上传到网络中",
    previousPage: "上一页",
    saveAccount: "保存账号",
    save: "保存",
    saveChanges: "保存修改",
    saved: "密码已保存到本地。",
    savedAccounts: "已保存账号",
    show: "显示",
    updated: "密码已更新到本地。",
    url: "网址",
    usernamePlaceholder: "请输入账号",
    validationRequired: "请填写显示名称、网址和账号。"
  },
  en: {
    account: "Account",
    add: "Add",
    addFirstAccount: "Add First Account",
    addPassword: "Add Password",
    cancel: "Cancel",
    accountCopied: "Account copied.",
    actions: "Actions",
    all: "All",
    copy: "Copy",
    copyFailed: "Copy failed. Please copy manually.",
    currentSite: "Current site",
    delete: "Delete",
    deleteConfirm: (displayName) => `Delete password for ${displayName}?`,
    deleted: "Password deleted locally.",
    displayName: "Display name",
    displayNamePlaceholder: "A name that helps you recognize this account",
    edit: "Edit",
    editPassword: "Edit Password",
    export: "Export",
    exported: "Password vault exported.",
    failedImport: "Failed to import password vault.",
    hide: "Hide",
    import: "Import",
    imported: "Password vault imported locally.",
    invalidImport: "Invalid import file.",
    language: "Language",
    localPasswordManager: "Local Password Manager",
    menu: "Menu",
    matchedAccounts: "Matched Accounts",
    nextPage: "Next",
    noActiveSite: "No active site detected",
    noActiveSiteHelp: "Open this popup on a website to match saved accounts.",
    noMatch: "No account matches the current website.",
    noPasswords: "No passwords saved yet.",
    noOtherSitePasswords: "No accounts for other sites.",
    otherSites: "Other Sites",
    pageStatus: (currentPage, totalPages) => `${currentPage} / ${totalPages}`,
    password: "Password",
    passwordCopied: "Password copied.",
    passwordManager: "Password Manager",
    passwordPlaceholder: "This password stays on your computer and is never uploaded.",
    previousPage: "Previous",
    saveAccount: "Save Account",
    save: "Save",
    saveChanges: "Save Changes",
    saved: "Password saved locally.",
    savedAccounts: "Saved Accounts",
    show: "Show",
    updated: "Password updated locally.",
    url: "URL",
    usernamePlaceholder: "Enter account",
    validationRequired: "Display name, URL, and account are required."
  }
};
