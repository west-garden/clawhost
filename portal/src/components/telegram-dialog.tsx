"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addChannel } from "@/lib/actions";
import {
  getChannelSchema,
  getVisibleFields,
  validateFields,
} from "@/lib/channel-schemas";

interface TelegramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Inline tag input sub-component
// ---------------------------------------------------------------------------

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim().replace(/[,;]$/, "");
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setValue("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && value === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function remove(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
      {tags.map((tag, i) => (
        <Badge key={i} variant="secondary" className="flex items-center gap-1">
          {tag}
          <button
            type="button"
            className="ml-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => remove(i)}
          >
            &times;
          </button>
        </Badge>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function TelegramDialog({
  open,
  onOpenChange,
  agentId,
  onSuccess,
}: TelegramDialogProps) {
  const t = useTranslations();
  const schema = getChannelSchema("telegram")!;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [botToken, setBotToken] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [dmPolicy, setDmPolicy] = useState("pairing");
  const [groupPolicy, setGroupPolicy] = useState("open");
  const [groups, setGroups] = useState<string[]>([]);
  const [groupAllowFrom, setGroupAllowFrom] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setBotToken("");
    setProxyUrl("");
    setWebhookUrl("");
    setDmPolicy("pairing");
    setGroupPolicy("open");
    setGroups([]);
    setGroupAllowFrom([]);
    setEnabled(true);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (next) reset();
    onOpenChange(next);
  }

  function buildFormData(): Record<string, unknown> {
    return {
      botToken,
      proxyUrl,
      webhookUrl,
      dmPolicy,
      groupPolicy,
      groups,
      groupAllowFrom,
      enabled,
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = buildFormData();
    const visibleFields = getVisibleFields(schema, formData);
    // Temporarily swap schema fields so validation only checks visible fields
    const validation = validateFields(
      { ...schema, fields: visibleFields },
      formData,
      false
    );

    if (validation) {
      setError(t(validation));
      setLoading(false);
      return;
    }

    const result = await addChannel(agentId, "telegram", {
      botToken,
      proxyUrl,
      webhookUrl,
      dmPolicy,
      groupPolicy,
      groups,
      groupAllowFrom,
      enabled,
    });

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
    } else {
      toast.success(t("channels.telegram.added"));
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("channels.telegram.name")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* botToken */}
          <div className="space-y-2">
            <Label htmlFor="botToken">{t("channels.fieldBotToken")}</Label>
            <Input
              id="botToken"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={t("channels.fieldBotTokenPlaceholder")}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("channels.fieldBotTokenHintCreate")}
            </p>
          </div>

          {/* proxyUrl */}
          <div className="space-y-2">
            <Label htmlFor="proxyUrl">{t("channels.fieldProxyUrl")}</Label>
            <Input
              id="proxyUrl"
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder={t("channels.fieldProxyUrlPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("channels.fieldProxyUrlHint")}
            </p>
          </div>

          {/* webhookUrl */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">{t("channels.fieldWebhookUrl")}</Label>
            <Input
              id="webhookUrl"
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={t("channels.fieldWebhookUrlPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("channels.fieldWebhookUrlHint")}
            </p>
          </div>

          {/* dmPolicy */}
          <div className="space-y-2">
            <Label htmlFor="dmPolicy">{t("channels.dmPolicy")}</Label>
            <select
              id="dmPolicy"
              value={dmPolicy}
              onChange={(e) => setDmPolicy(e.target.value)}
              className={selectClass}
            >
              <option value="pairing">{t("channels.dmPolicyPairing")}</option>
              <option value="allowlist">
                {t("channels.dmPolicyAllowlist")}
              </option>
              <option value="disabled">{t("channels.dmPolicyDisabled")}</option>
            </select>
          </div>

          {/* groupPolicy */}
          <div className="space-y-2">
            <Label htmlFor="groupPolicy">{t("channels.groupPolicy")}</Label>
            <select
              id="groupPolicy"
              value={groupPolicy}
              onChange={(e) => setGroupPolicy(e.target.value)}
              className={selectClass}
            >
              <option value="open">{t("channels.groupPolicyOpen")}</option>
              <option value="allowlist">
                {t("channels.groupPolicyAllowlist")}
              </option>
              <option value="disabled">{t("channels.groupPolicyDisabled")}</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {t("channels.fieldGroupPolicyHint")}
            </p>
          </div>

          {/* groups — conditional */}
          {groupPolicy === "allowlist" && (
            <div className="space-y-2">
              <Label>{t("channels.allowedGroups")}</Label>
              <TagInput
                tags={groups}
                onChange={setGroups}
                placeholder={t("channels.telegramAllowedGroupsHint")}
              />
              <p className="text-xs text-muted-foreground">
                {t("channels.telegramAllowedGroupsHint")}
              </p>
            </div>
          )}

          {/* groupAllowFrom — conditional */}
          {groupPolicy === "allowlist" && (
            <div className="space-y-2">
              <Label>{t("channels.groupAllowFrom")}</Label>
              <TagInput
                tags={groupAllowFrom}
                onChange={setGroupAllowFrom}
                placeholder={t("channels.telegramGroupAllowFromHint")}
              />
              <p className="text-xs text-muted-foreground">
                {t("channels.telegramGroupAllowFromHint")}
              </p>
            </div>
          )}

          {/* enabled */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>{t("channels.enableAccount")}</Label>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("common.confirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
