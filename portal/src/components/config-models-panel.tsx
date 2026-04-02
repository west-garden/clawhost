"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  addModelProvider,
  updateModelProvider,
  deleteModelProvider,
} from "@/lib/actions";

interface Provider {
  baseUrl?: string;
  apiKey?: string;
  models?: Array<{ id: string; name?: string }>;
}

interface Props {
  agentId: string;
  providers: Record<string, Provider>;
  loading: boolean;
  onRefresh: () => void;
}

export function ConfigModelsPanel({ agentId, providers, loading, onRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function openAddDialog() {
    setEditingProvider(null);
    setForm({ name: "", baseUrl: "", apiKey: "" });
    setDialogOpen(true);
  }

  function openEditDialog(name: string, provider: Provider) {
    setEditingProvider(name);
    setForm({
      name,
      baseUrl: provider.baseUrl || "",
      apiKey: "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (editingProvider) {
        const result = await updateModelProvider(agentId, editingProvider, {
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Provider updated");
      } else {
        const result = await addModelProvider(agentId, {
          name: form.name,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Provider added");
      }
      setDialogOpen(false);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete provider "${name}"?`)) return;
    const result = await deleteModelProvider(agentId, name);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider deleted");
      onRefresh();
    }
  }

  if (loading) {
    return <div className="text-white/50 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(providers).map(([name, provider]) => (
        <div
          key={name}
          className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/5"
        >
          <div>
            <p className="text-sm font-medium text-white">{name}</p>
            {provider.baseUrl && (
              <p className="text-xs text-white/40 font-mono">{provider.baseUrl}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditDialog(name, provider)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              onClick={() => handleDelete(name)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={openAddDialog}>
        Add Provider
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "Edit Provider" : "Add Provider"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingProvider && (
              <div className="space-y-2">
                <Label>Provider Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="openai, anthropic, etc."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}