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

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  monthly_credits: number;
  max_agents: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: "0",
    monthly_credits: "0",
    max_agents: "1",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/subscription/plans", {
        credentials: "include",
      });
      const data = await res.json();
      if (data.code === 0) {
        setPlans(data.data || []);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Failed to load plans");
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingPlan(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      price: "0",
      monthly_credits: "0",
      max_agents: "1",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const url = editingPlan
        ? `/api/v1/admin/subscription/plans/${editingPlan.id}`
        : "/api/v1/admin/subscription/plans";
      const method = editingPlan ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          monthly_credits: parseInt(form.monthly_credits),
          max_agents: parseInt(form.max_agents),
        }),
      });

      const data = await res.json();
      if (data.code === 0) {
        toast.success(editingPlan ? "Plan updated" : "Plan created");
        setDialogOpen(false);
        loadPlans();
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
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm">
            Manage subscription plans for users
          </p>
        </div>
        <Button onClick={openCreateDialog}>Create Plan</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Credits/Month</TableHead>
                <TableHead>Max Agents</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {plan.slug}
                    </code>
                  </TableCell>
                  <TableCell>${plan.price}</TableCell>
                  <TableCell>{plan.monthly_credits}</TableCell>
                  <TableCell>{plan.max_agents}</TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
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
            <DialogTitle>
              {editingPlan ? "Edit Plan" : "Create Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Pro Plan"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="pro"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="For power users"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Credits</Label>
                <Input
                  type="number"
                  value={form.monthly_credits}
                  onChange={(e) => setForm({ ...form, monthly_credits: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Agents</Label>
                <Input
                  type="number"
                  value={form.max_agents}
                  onChange={(e) => setForm({ ...form, max_agents: e.target.value })}
                />
              </div>
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