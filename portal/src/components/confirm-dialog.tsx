"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  requireInput?: string;
  inputPlaceholder?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  requireInput,
  inputPlaceholder,
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const [inputValue, setInputValue] = useState("");

  const canConfirm = requireInput ? inputValue === requireInput : true;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setInputValue("");
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {requireInput && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={!canConfirm || loading}
            onClick={handleConfirm}
          >
            {loading ? t("loading") : confirmText || t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
