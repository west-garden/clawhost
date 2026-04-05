export interface ChannelFieldConfig {
  id: string;
  label: string;
  type: "text" | "password" | "number" | "select" | "textarea" | "tags" | "switch";
  required: boolean;
  placeholder?: string;
  hint?: string;
  isSecret?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  showWhen?: { field: string; value: string | string[] };
}

export interface ChannelSchema {
  fields: ChannelFieldConfig[];
  commonFields?: {
    enabled?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Shared policy options
// ---------------------------------------------------------------------------

const DM_POLICY_OPTIONS = [
  { value: "pairing", label: "channels.dmPolicyPairing" },
  { value: "allowlist", label: "channels.dmPolicyAllowlist" },
  { value: "disabled", label: "channels.dmPolicyDisabled" },
];

const GROUP_POLICY_OPTIONS = [
  { value: "open", label: "channels.groupPolicyOpen" },
  { value: "allowlist", label: "channels.groupPolicyAllowlist" },
  { value: "disabled", label: "channels.groupPolicyDisabled" },
];

const TRUE_FALSE_OPTIONS = [
  { value: "true", label: "common.true" },
  { value: "false", label: "common.false" },
];

// ---------------------------------------------------------------------------
// Per-channel schemas
// ---------------------------------------------------------------------------

const TELEGRAM_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "botToken",
      label: "channels.fieldBotToken",
      type: "password",
      required: true,
      placeholder: "channels.fieldBotTokenPlaceholder",
      hint: "channels.fieldBotTokenHintCreate",
      isSecret: true,
    },
    {
      id: "proxyUrl",
      label: "channels.fieldProxyUrl",
      type: "text",
      required: false,
      placeholder: "channels.fieldProxyUrlPlaceholder",
      hint: "channels.fieldProxyUrlHint",
    },
    {
      id: "webhookUrl",
      label: "channels.fieldWebhookUrl",
      type: "text",
      required: false,
      placeholder: "channels.fieldWebhookUrlPlaceholder",
      hint: "channels.fieldWebhookUrlHint",
    },
    {
      id: "dmPolicy",
      label: "channels.dmPolicy",
      type: "select",
      required: false,
      defaultValue: "pairing",
      options: DM_POLICY_OPTIONS,
    },
    {
      id: "groupPolicy",
      label: "channels.groupPolicy",
      type: "select",
      required: false,
      defaultValue: "open",
      options: GROUP_POLICY_OPTIONS,
      hint: "channels.fieldGroupPolicyHint",
    },
    {
      id: "groups",
      label: "channels.allowedGroups",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
      hint: "channels.telegramAllowedGroupsHint",
    },
    {
      id: "groupAllowFrom",
      label: "channels.groupAllowFrom",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
      hint: "channels.telegramGroupAllowFromHint",
    },
  ],
  commonFields: { enabled: true },
};

const DISCORD_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "token",
      label: "channels.fieldToken",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "dmPolicy",
      label: "channels.dmPolicy",
      type: "select",
      required: false,
      defaultValue: "pairing",
      options: DM_POLICY_OPTIONS,
    },
    {
      id: "groupPolicy",
      label: "channels.groupPolicy",
      type: "select",
      required: false,
      defaultValue: "open",
      options: GROUP_POLICY_OPTIONS,
    },
    {
      id: "groups",
      label: "channels.allowedGroups",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
    {
      id: "groupAllowFrom",
      label: "channels.groupAllowFrom",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
  ],
  commonFields: { enabled: true },
};

const SLACK_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "botToken",
      label: "channels.fieldBotToken",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "appToken",
      label: "channels.fieldAppToken",
      type: "password",
      required: false,
      isSecret: true,
    },
    {
      id: "mode",
      label: "channels.mode",
      type: "select",
      required: false,
      defaultValue: "socket",
      options: [
        { value: "socket", label: "channels.modeSocket" },
        { value: "http", label: "channels.modeHttp" },
      ],
    },
    {
      id: "dmPolicy",
      label: "channels.dmPolicy",
      type: "select",
      required: false,
      defaultValue: "pairing",
      options: DM_POLICY_OPTIONS,
    },
    {
      id: "groupPolicy",
      label: "channels.groupPolicy",
      type: "select",
      required: false,
      defaultValue: "open",
      options: GROUP_POLICY_OPTIONS,
    },
    {
      id: "groups",
      label: "channels.allowedGroups",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
    {
      id: "groupAllowFrom",
      label: "channels.groupAllowFrom",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
  ],
  commonFields: { enabled: true },
};

const FEISHU_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "appId",
      label: "channels.fieldAppId",
      type: "text",
      required: true,
    },
    {
      id: "appSecret",
      label: "channels.fieldAppSecret",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "domain",
      label: "channels.fieldDomain",
      type: "select",
      required: false,
      defaultValue: "feishu",
      options: [
        { value: "feishu", label: "channels.domainFeishu" },
        { value: "lark", label: "channels.domainLark" },
      ],
    },
    {
      id: "connectionMode",
      label: "channels.connectionMode",
      type: "select",
      required: false,
      defaultValue: "websocket",
      options: [
        { value: "websocket", label: "channels.modeWebsocket" },
        { value: "webhook", label: "channels.modeWebhook" },
      ],
    },
    {
      id: "verificationToken",
      label: "channels.fieldVerificationToken",
      type: "password",
      required: false,
      isSecret: true,
      showWhen: { field: "connectionMode", value: "webhook" },
    },
    {
      id: "encryptKey",
      label: "channels.fieldEncryptKey",
      type: "password",
      required: false,
      isSecret: true,
      showWhen: { field: "connectionMode", value: "webhook" },
    },
    {
      id: "dmPolicy",
      label: "channels.dmPolicy",
      type: "select",
      required: false,
      defaultValue: "pairing",
      options: [
        { value: "pairing", label: "channels.dmPolicyPairing" },
        { value: "allowlist", label: "channels.dmPolicyAllowlist" },
        { value: "disabled", label: "channels.dmPolicyDisabled" },
      ],
    },
    {
      id: "groupPolicy",
      label: "channels.groupPolicy",
      type: "select",
      required: false,
      defaultValue: "allowlist",
      options: GROUP_POLICY_OPTIONS,
    },
    {
      id: "groups",
      label: "channels.allowedGroups",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
    {
      id: "requireMention",
      label: "channels.requireMention",
      type: "select",
      required: false,
      defaultValue: "true",
      options: TRUE_FALSE_OPTIONS,
    },
  ],
  commonFields: { enabled: true },
};

const SIGNAL_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "account",
      label: "channels.fieldAccount",
      type: "text",
      required: true,
    },
    {
      id: "httpUrl",
      label: "channels.fieldHttpUrl",
      type: "text",
      required: false,
    },
    {
      id: "dmPolicy",
      label: "channels.dmPolicy",
      type: "select",
      required: false,
      defaultValue: "pairing",
      options: DM_POLICY_OPTIONS,
    },
    {
      id: "groupPolicy",
      label: "channels.groupPolicy",
      type: "select",
      required: false,
      defaultValue: "open",
      options: GROUP_POLICY_OPTIONS,
    },
    {
      id: "groups",
      label: "channels.allowedGroups",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
    {
      id: "groupAllowFrom",
      label: "channels.groupAllowFrom",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
  ],
  commonFields: { enabled: true },
};

const MATRIX_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "homeserver",
      label: "channels.fieldHomeserver",
      type: "text",
      required: true,
    },
    {
      id: "userId",
      label: "channels.fieldUserId",
      type: "text",
      required: true,
    },
    {
      id: "password",
      label: "channels.fieldPassword",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "encryption",
      label: "channels.fieldEncryption",
      type: "select",
      required: false,
      defaultValue: "true",
      options: TRUE_FALSE_OPTIONS,
    },
  ],
  commonFields: { enabled: true },
};

const LINE_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "channelAccessToken",
      label: "channels.fieldChannelAccessToken",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "channelSecret",
      label: "channels.fieldChannelSecret",
      type: "password",
      required: true,
      isSecret: true,
    },
  ],
  commonFields: { enabled: true },
};

const MSTEAMS_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "appId",
      label: "channels.fieldAppId",
      type: "text",
      required: true,
    },
    {
      id: "appPassword",
      label: "channels.fieldAppPassword",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "tenantId",
      label: "channels.fieldTenantId",
      type: "text",
      required: false,
    },
    {
      id: "dmPolicy",
      label: "channels.dmPolicy",
      type: "select",
      required: false,
      defaultValue: "pairing",
      options: DM_POLICY_OPTIONS,
    },
    {
      id: "groupPolicy",
      label: "channels.groupPolicy",
      type: "select",
      required: false,
      defaultValue: "open",
      options: GROUP_POLICY_OPTIONS,
    },
    {
      id: "groups",
      label: "channels.allowedGroups",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
    {
      id: "groupAllowFrom",
      label: "channels.groupAllowFrom",
      type: "tags",
      required: false,
      showWhen: { field: "groupPolicy", value: "allowlist" },
    },
  ],
  commonFields: { enabled: true },
};

const MATTERMOST_SCHEMA: ChannelSchema = {
  fields: [
    {
      id: "botToken",
      label: "channels.fieldBotToken",
      type: "password",
      required: true,
      isSecret: true,
    },
    {
      id: "baseUrl",
      label: "channels.fieldBaseUrl",
      type: "text",
      required: true,
    },
  ],
  commonFields: { enabled: true },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CHANNEL_SCHEMAS: Record<string, ChannelSchema> = {
  telegram: TELEGRAM_SCHEMA,
  discord: DISCORD_SCHEMA,
  slack: SLACK_SCHEMA,
  feishu: FEISHU_SCHEMA,
  signal: SIGNAL_SCHEMA,
  matrix: MATRIX_SCHEMA,
  line: LINE_SCHEMA,
  msteams: MSTEAMS_SCHEMA,
  mattermost: MATTERMOST_SCHEMA,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getChannelSchema(channelId: string): ChannelSchema | undefined {
  return CHANNEL_SCHEMAS[channelId];
}

export function getVisibleFields(
  schema: ChannelSchema,
  formData: Record<string, unknown>,
): ChannelFieldConfig[] {
  return schema.fields.filter((field) => {
    if (!field.showWhen) return true;
    const currentValue = formData[field.showWhen.field];
    const expected = field.showWhen.value;
    if (Array.isArray(expected)) {
      return expected.includes(String(currentValue ?? ""));
    }
    return String(currentValue ?? "") === expected;
  });
}

export function validateFields(
  schema: ChannelSchema,
  formData: Record<string, unknown>,
  isEdit: boolean,
): string | null {
  for (const field of schema.fields) {
    if (!field.required) continue;

    const value = formData[field.id];

    // During edit mode, a secret field that is already stored may be left
    // blank on the form (meaning "keep existing value").
    if (isEdit && field.isSecret && (value === undefined || value === "")) {
      continue;
    }

    if (value === undefined || value === null || value === "") {
      return field.label;
    }
  }
  return null;
}
