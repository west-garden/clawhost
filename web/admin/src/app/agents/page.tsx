"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLinkIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getAdminConfig,
  listApps,
  listBots,
  type App,
  type Bot,
} from "@/lib/api";

const statusStyles: Record<string, string> = {
  running: "bg-green-100 text-green-700 border-green-200",
  starting: "bg-yellow-100 text-yellow-700 border-yellow-200",
  created: "bg-blue-100 text-blue-700 border-blue-200",
  stopped: "bg-gray-100 text-gray-600 border-gray-200",
  error: "bg-red-100 text-red-700 border-red-200",
};

function BotActions({ bot }: { bot: Bot }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-2 hover:bg-accent hover:text-accent-foreground">
        ...
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(bot.id);
            toast.success("Agent ID copied");
          }}
        >
          Copy ID
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(bot.access_token);
            toast.success("Access token copied");
          }}
        >
          Copy Token
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AgentsPage() {
  const { isAuthed } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [appMap, setAppMap] = useState<Record<string, App>>({});
  const [globalDomainTemplate, setGlobalDomainTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchBots = useCallback(async () => {
    try {
      setLoading(true);
      const [botsRes, appsRes, configRes] = await Promise.all([
        listBots(),
        listApps(),
        getAdminConfig(),
      ]);
      setBots(botsRes.data || []);
      const map: Record<string, App> = {};
      for (const app of appsRes.data || []) {
        map[app.id] = app;
      }
      setAppMap(map);
      setGlobalDomainTemplate(configRes.data?.bot_domain_template || "");
    } catch (err) {
      toast.error("Failed to load agents: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getBotUrl = (bot: Bot): string => {
    // Use access_url from API (includes token)
    if (bot.access_url) return bot.access_url;
    // Fallback to template-based URL (without token)
    const app = appMap[bot.app_id];
    const template = app?.bot_domain_template || globalDomainTemplate;
    if (!template) return "";
    return template
      .replace("{bot_id}", bot.slug)
      .replace("{slug}", bot.slug);
  };

  const getBotDomain = (bot: Bot): string => {
    const url = getBotUrl(bot);
    if (!url) return bot.slug;
    return url.replace(/^https?:\/\//, "");
  };

  useEffect(() => {
    if (isAuthed) fetchBots();
  }, [isAuthed, fetchBots]);

  if (!isAuthed) return null;

  const runningCount = bots.filter((b) => b.status === "running").length;
  const stoppedCount = bots.filter((b) => b.status === "stopped").length;
  const filteredBots = statusFilter === "all" ? bots : bots.filter((b) => b.status === statusFilter);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm">
            View all agents (managed by users in Portal)
          </p>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="starting">Starting</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {bots.length} total &middot; {runningCount} running &middot; {stoppedCount} stopped
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredBots.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No agents yet</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>App ID</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBots.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell className="font-medium">{bot.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {bot.app_id.slice(0, 8)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {bot.user_id.slice(0, 8)}
                      </code>
                    </TableCell>
                    <TableCell>
                      {getBotUrl(bot) ? (
                        <a
                          href={getBotUrl(bot)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <code>{getBotDomain(bot)}</code>
                          <ExternalLinkIcon className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <code className="text-xs text-muted-foreground">{getBotDomain(bot)}</code>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[bot.status] || ""}>
                        {bot.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(bot.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <BotActions bot={bot} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / Tablet cards */}
          <div className="lg:hidden space-y-3">
            {filteredBots.map((bot) => (
              <Card key={bot.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{bot.name}</span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${statusStyles[bot.status] || ""}`}
                        >
                          {bot.status}
                        </Badge>
                      </div>
                    </div>
                    <BotActions bot={bot} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <div className="col-span-2">
                      <span className="text-foreground/50">Domain</span>
                      {getBotUrl(bot) ? (
                        <a
                          href={getBotUrl(bot)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-muted px-1 py-0.5 rounded mt-0.5 hover:text-foreground transition-colors"
                        >
                          <code className="truncate">{getBotDomain(bot)}</code>
                          <ExternalLinkIcon className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <code className="block bg-muted px-1 py-0.5 rounded mt-0.5 truncate">
                          {getBotDomain(bot)}
                        </code>
                      )}
                    </div>
                    <div>
                      <span className="text-foreground/50">App ID</span>
                      <code className="block bg-muted px-1 py-0.5 rounded mt-0.5">
                        {bot.app_id.slice(0, 8)}
                      </code>
                    </div>
                    <div>
                      <span className="text-foreground/50">Created</span>
                      <p>{new Date(bot.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}