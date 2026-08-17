import type { Locale } from "./locale";

type Messages = {
  readonly account: string;
  readonly add: string;
  readonly addDomainRule: string;
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
  readonly developerTools: string;
  readonly displayName: string;
  readonly displayNamePlaceholder: string;
  readonly domainSwitcher: string;
  readonly domainSwitcherFailed: string;
  readonly domainSwitcherInvalid: string;
  readonly domainSwitcherNoMatch: string;
  readonly domainSwitcherRequired: string;
  readonly domainSwitcherSwitchedToLocal: string;
  readonly domainSwitcherSwitchedToOnline: string;
  readonly domainRuleDeleted: string;
  readonly domainRuleDeleteConfirm: (onlineDomain: string, localDomain: string) => string;
  readonly domainRuleSaved: string;
  readonly domainRuleSaveFailed: string;
  readonly duplicateAccount: string;
  readonly edit: string;
  readonly editPassword: string;
  readonly export: string;
  readonly exported: string;
  readonly failedImport: string;
  readonly failedSave: string;
  readonly frontendDeveloperTools: string;
  readonly hide: string;
  readonly import: string;
  readonly imported: string;
  readonly invalidImport: string;
  readonly invalidUrl: string;
  readonly language: string;
  readonly localPasswordManager: string;
  readonly localDomain: string;
  readonly localDomainPlaceholder: string;
  readonly menu: string;
  readonly matchedAccounts: string;
  readonly nextPage: string;
  readonly noActiveSite: string;
  readonly noActiveSiteHelp: string;
  readonly noMatch: string;
  readonly noDomainRules: string;
  readonly noPasswords: string;
  readonly noOtherSitePasswords: string;
  readonly otherSites: string;
  readonly onlineDomain: string;
  readonly onlineDomainPlaceholder: string;
  readonly pageStatus: (currentPage: number, totalPages: number) => string;
  readonly password: string;
  readonly passwordCopied: string;
  readonly passwordManager: string;
  readonly passwordPlaceholder: string;
  readonly previousPage: string;
  readonly saveAccount: string;
  readonly save: string;
  readonly saveChanges: string;
  readonly saveDomainRule: string;
  readonly saved: string;
  readonly savedAccounts: string;
  readonly savedDomainRules: string;
  readonly select: string;
  readonly selected: string;
  readonly show: string;
  readonly switchDomain: string;
  readonly switchToLocalDomain: string;
  readonly switchToOnlineDomain: string;
  readonly updated: string;
  readonly url: string;
  readonly usernamePlaceholder: string;
  readonly validationRequired: string;
};

export const messages: Record<Locale, Messages> = {
  "zh-CN": {
    account: "账号",
    add: "新增",
    addDomainRule: "新增规则",
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
    developerTools: "开发工具",
    displayName: "显示名称",
    displayNamePlaceholder: "方便区分这是账号名",
    domainSwitcher: "域名替换",
    domainSwitcherFailed: "域名切换失败。",
    domainSwitcherInvalid: "请输入有效的线上域名和本地开发域名。",
    domainSwitcherNoMatch: "当前网址未命中线上或本地域名。",
    domainSwitcherRequired: "请填写线上域名和本地开发域名。",
    domainSwitcherSwitchedToLocal: "已切换到本地开发域名。",
    domainSwitcherSwitchedToOnline: "已切换到线上域名。",
    domainRuleDeleted: "域名规则已删除。",
    domainRuleDeleteConfirm: (onlineDomain, localDomain) =>
      `确定删除「${onlineDomain} ↔ ${localDomain}」吗？`,
    domainRuleSaved: "域名规则已保存。",
    domainRuleSaveFailed: "域名规则保存失败。",
    duplicateAccount: "当前网站已存在相同账号。",
    edit: "编辑",
    editPassword: "编辑密码",
    export: "导出",
    exported: "密码库已导出。",
    failedImport: "密码库导入失败。",
    failedSave: "密码保存失败。",
    frontendDeveloperTools: "前端开发工具",
    hide: "隐藏",
    import: "导入",
    imported: "密码库已导入本地。",
    invalidImport: "导入文件格式无效。",
    invalidUrl: "请输入有效的网址。",
    language: "语言",
    localPasswordManager: "本地密码管理器",
    localDomain: "本地开发域名",
    localDomainPlaceholder: "localhost:5173",
    menu: "菜单",
    matchedAccounts: "匹配账号",
    nextPage: "下一页",
    noActiveSite: "未检测到当前网站",
    noActiveSiteHelp: "在网站页面打开插件后，会自动匹配已保存账号。",
    noMatch: "当前网站没有匹配账号。",
    noDomainRules: "还没有保存域名规则。",
    noPasswords: "还没有保存密码。",
    noOtherSitePasswords: "没有其他网站账号。",
    otherSites: "其他网站",
    onlineDomain: "线上域名",
    onlineDomainPlaceholder: "www.example.com",
    pageStatus: (currentPage, totalPages) => `${currentPage} / ${totalPages}`,
    password: "密码",
    passwordCopied: "密码已复制。",
    passwordManager: "密码管理器",
    passwordPlaceholder: "密码存在你的电脑上，并不会上传到网络中",
    previousPage: "上一页",
    saveAccount: "保存账号",
    save: "保存",
    saveChanges: "保存修改",
    saveDomainRule: "保存规则",
    saved: "密码已保存到本地。",
    savedAccounts: "已保存账号",
    savedDomainRules: "已保存规则",
    select: "选择",
    selected: "已选中",
    show: "显示",
    switchDomain: "切换域名",
    switchToLocalDomain: "切换为本地",
    switchToOnlineDomain: "切换为线上",
    updated: "密码已更新到本地。",
    url: "网址",
    usernamePlaceholder: "请输入账号",
    validationRequired: "请填写显示名称、网址和账号。"
  },
  en: {
    account: "Account",
    add: "Add",
    addDomainRule: "Add Rule",
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
    developerTools: "Developer Tools",
    displayName: "Display name",
    displayNamePlaceholder: "A name that helps you recognize this account",
    domainSwitcher: "Domain Switcher",
    domainSwitcherFailed: "Failed to switch domain.",
    domainSwitcherInvalid: "Enter valid online and local development domains.",
    domainSwitcherNoMatch: "The current URL does not match either domain.",
    domainSwitcherRequired: "Online domain and local development domain are required.",
    domainSwitcherSwitchedToLocal: "Switched to the local development domain.",
    domainSwitcherSwitchedToOnline: "Switched to the online domain.",
    domainRuleDeleted: "Domain rule deleted.",
    domainRuleDeleteConfirm: (onlineDomain, localDomain) =>
      `Delete ${onlineDomain} ↔ ${localDomain}?`,
    domainRuleSaved: "Domain rule saved.",
    domainRuleSaveFailed: "Failed to save domain rule.",
    duplicateAccount: "This account already exists for the current site.",
    edit: "Edit",
    editPassword: "Edit Password",
    export: "Export",
    exported: "Password vault exported.",
    failedImport: "Failed to import password vault.",
    failedSave: "Failed to save password.",
    frontendDeveloperTools: "Frontend Developer Tools",
    hide: "Hide",
    import: "Import",
    imported: "Password vault imported locally.",
    invalidImport: "Invalid import file.",
    invalidUrl: "Enter a valid URL.",
    language: "Language",
    localPasswordManager: "Local Password Manager",
    localDomain: "Local development domain",
    localDomainPlaceholder: "localhost:5173",
    menu: "Menu",
    matchedAccounts: "Matched Accounts",
    nextPage: "Next",
    noActiveSite: "No active site detected",
    noActiveSiteHelp: "Open this popup on a website to match saved accounts.",
    noMatch: "No account matches the current website.",
    noDomainRules: "No saved domain rules yet.",
    noPasswords: "No passwords saved yet.",
    noOtherSitePasswords: "No accounts for other sites.",
    otherSites: "Other Sites",
    onlineDomain: "Online domain",
    onlineDomainPlaceholder: "www.example.com",
    pageStatus: (currentPage, totalPages) => `${currentPage} / ${totalPages}`,
    password: "Password",
    passwordCopied: "Password copied.",
    passwordManager: "Password Manager",
    passwordPlaceholder: "This password stays on your computer and is never uploaded.",
    previousPage: "Previous",
    saveAccount: "Save Account",
    save: "Save",
    saveChanges: "Save Changes",
    saveDomainRule: "Save Rule",
    saved: "Password saved locally.",
    savedAccounts: "Saved Accounts",
    savedDomainRules: "Saved Rules",
    select: "Select",
    selected: "Selected",
    show: "Show",
    switchDomain: "Switch Domain",
    switchToLocalDomain: "Switch to Local",
    switchToOnlineDomain: "Switch to Online",
    updated: "Password updated locally.",
    url: "URL",
    usernamePlaceholder: "Enter account",
    validationRequired: "Display name, URL, and account are required."
  }
};
