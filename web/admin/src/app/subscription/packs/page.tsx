"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus_credits: number;
  is_active: boolean;
  created_at: string;
}

export default function CreditPacksPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    credits: "100",
    price: "10",
    bonus_credits: "0",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPacks();
  }, []);

  async function loadPacks() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/subscription/credit-packs", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.code === 0) {
        setPacks(data.data || []);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Failed to load credit packs");
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setForm({
      name: "",
      credits: "100",
      price: "10",
      bonus_credits: "0",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/subscription/credit-packs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          credits: parseInt(form.credits),
          price: parseFloat(form.price),
          bonus_credits: parseInt(form.bonus_credits),
        }),
      });

      const data = await res.json();
      if (data.code === 0) {
        toast.success("Credit pack created");
        setDialogOpen(false);
        loadPacks();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Operation failed");
    }
    setSubmitting(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Packs</h1>
          <p className="text-muted-foreground text-sm">
            Manage one-time purchasable credit packs
          </p>
        </div>
        <Button onClick={openCreateDialog}>Create Pack</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packs.map((pack) => (
                <TableRow key={pack.id}>
                  <TableCell className="font-medium">{pack.name}</TableCell>
                  <TableCell>{pack.credits.toLocaleString()}</TableCell>
                  <TableCell>
                    {pack.bonus_credits > 0 ? `+${pack.bonus_credits}` : "-"}
                  </TableCell>
                  <TableCell>${pack.price}</TableCell>
                  <TableCell>
                    <Badge variant={pack.is_active ? "default" : "secondary"}>
                      {pack.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Credit Pack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Starter Pack"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Credits</Label>
                <Input
                  type="number"
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bonus Credits</Label>
                <Input
                  type="number"
                  value={form.bonus_credits}
                  onChange={(e) => setForm({ ...form, bonus_credits: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}