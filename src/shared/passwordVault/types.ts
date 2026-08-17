export type PasswordEntry = {
  readonly id: string;
  readonly displayName: string;
  readonly url: string;
  readonly hostname: string;
  readonly username: string;
  readonly password: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PasswordEntryDraft = {
  readonly displayName: string;
  readonly url: string;
  readonly username: string;
  readonly password: string;
};

export type PasswordVaultExport = {
  readonly version: 1;
  readonly exportedAt: string;
  readonly entries: readonly PasswordEntry[];
};
