import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleSlash2,
  Clock3,
  FileText,
  Inbox,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const audienceMetrics = [
  { label: "Eligible now", value: "--", note: "Awaiting first Shopify sync", icon: Users, tone: "text-emerald-700 bg-emerald-50" },
  { label: "Cooling period", value: "--", note: "Seven days after support", icon: Clock3, tone: "text-amber-700 bg-amber-50" },
  { label: "Suppressed", value: "--", note: "Opt-outs and service blocks", icon: CircleSlash2, tone: "text-red-700 bg-red-50" },
  { label: "At 30-day cap", value: "--", note: "Maximum two messages", icon: ShieldCheck, tone: "text-slate-700 bg-slate-100" },
];

const gates = [
  { label: "WhatsApp consent verified", detail: "Shopify or service-interface evidence" },
  { label: "Customer is satisfied", detail: "No open or unhappy support conversation" },
  { label: "Seven-day cooling period passed", detail: "Measured from the latest service message" },
  { label: "Frequency limit passed", detail: "Fewer than two sends in rolling 30 days" },
  { label: "Product and link validated", detail: "Active, in stock, and destination checked" },
];

const templates = [
  {
    name: "Travel reassurance",
    intent: "Useful story",
    message: "That small panic when your wallet is not where you left it? We made something for that. See how easyTag keeps the important bit findable: {{1}}",
    status: "Draft",
  },
  {
    name: "Private cohort offer",
    intent: "Limited deal",
    message: "A quiet one for you: we opened a private easyTag offer for a small group today. It closes {{1}}. Take a look here: {{2}}",
    status: "Draft",
  },
  {
    name: "Free travel gift",
    intent: "Monthly gift",
    message: "Packing soon? Buy two easyTag tracker cards and we will add a free {{1}}. Your private link has everything ready: {{2}}",
    status: "Draft",
  },
];

const exclusionRows = [
  { reason: "Open support case", handling: "Always blocked", tone: "text-red-700" },
  { reason: "Unhappy or unclear outcome", handling: "Blocked or manual review", tone: "text-red-700" },
  { reason: "Recent service contact", handling: "Held for seven days", tone: "text-amber-700" },
  { reason: "Two messages in 30 days", handling: "Held until limit resets", tone: "text-amber-700" },
  { reason: "No WhatsApp consent evidence", handling: "Never selected", tone: "text-slate-700" },
];

function StatusDot({ className }: { className: string }) {
  return <span className={cn("h-2 w-2 rounded-full", className)} aria-hidden="true" />;
}

function Marketing() {
  return (
    <div className="min-h-screen bg-[#f6f7f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#ff6600] text-white">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold">WhatsApp marketing</h1>
                <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50" variant="outline">
                  Staging
                </Badge>
              </div>
              <p className="truncate text-sm text-slate-500">easyTag campaign control</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label="Refresh campaign data" className="h-9 w-9" size="icon" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh campaign data</TooltipContent>
            </Tooltip>
            <Button asChild className="h-9 gap-2" variant="outline">
              <Link to="/">
                <Inbox className="h-4 w-4" />
                <span className="hidden sm:inline">Inbox</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#d95700]">Pilot workspace</p>
            <h2 className="mt-1 text-2xl font-semibold">Campaigns are safely locked</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              The interface is ready for the staging connection. Live sending stays unavailable until consent sync, satisfaction checks, and test delivery all pass.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <LockKeyhole className="h-4 w-4" />
            No live send endpoint
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="grid h-10 w-full grid-cols-3 rounded-[8px] bg-slate-200/70 p-1 sm:w-[420px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <section aria-labelledby="audience-health-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 id="audience-health-heading" className="text-base font-semibold">Audience health</h3>
                  <p className="text-sm text-slate-500">Authoritative counts appear after the first staging sync.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {audienceMetrics.map((metric) => (
                  <article key={metric.label} className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                        <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                      </div>
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-[8px]", metric.tone)}>
                        <metric.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{metric.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
              <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm" aria-labelledby="next-campaign-heading">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 id="next-campaign-heading" className="font-semibold">Next pilot campaign</h3>
                      <Badge className="border-slate-300 bg-white text-slate-700" variant="outline">Unarmed</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">A small cohort only after every gate passes.</p>
                  </div>
                  <Button className="gap-2 bg-[#ff6600] hover:bg-[#e85d00]" disabled>
                    <CalendarClock className="h-4 w-4" />
                    Schedule pilot
                  </Button>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#d95700]">Message preview</p>
                    <div className="mt-3 max-w-xl rounded-[8px] rounded-tl-none bg-[#e7f8ed] px-4 py-3 text-sm leading-6 text-slate-800">
                      That small panic when your wallet is not where you left it? We made something for that. See how easyTag keeps the important bit findable.
                      <div className="mt-3 text-[#087b41] underline">See the tracker card</div>
                      <p className="mt-3 text-xs text-slate-500">Manage WhatsApp preferences</p>
                    </div>
                  </div>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <dt className="text-slate-500">Cohort</dt>
                      <dd className="font-medium">25 people</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <dt className="text-slate-500">Frequency</dt>
                      <dd className="font-medium">1 this week</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <dt className="text-slate-500">Offer</dt>
                      <dd className="font-medium">None</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Template</dt>
                      <dd className="font-medium">Pending Meta</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="release-gates-heading">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="release-gates-heading" className="font-semibold">Release gates</h3>
                  <span className="text-sm font-medium text-slate-500">0 / {gates.length}</span>
                </div>
                <Progress className="mt-3 h-2" value={0} />
                <div className="mt-4 divide-y divide-slate-100">
                  {gates.map((gate) => (
                    <div key={gate.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                      <div>
                        <p className="text-sm font-medium">{gate.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{gate.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section aria-labelledby="results-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 id="results-heading" className="text-base font-semibold">Campaign evidence</h3>
                  <p className="text-sm text-slate-500">Delivery and conversion records will appear here.</p>
                </div>
              </div>
              <div className="grid overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm sm:grid-cols-3">
                {[
                  { label: "Delivered", value: "--", icon: MessageSquareText },
                  { label: "Clicked", value: "--", icon: MousePointerClick },
                  { label: "Orders", value: "--", icon: ShoppingBag },
                ].map((item, index) => (
                  <div key={item.label} className={cn("flex items-center gap-3 p-4", index > 0 && "border-t border-slate-200 sm:border-l sm:border-t-0")}>
                    <item.icon className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="audience" className="space-y-5">
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="font-semibold">Exclusion policy</h3>
                  <p className="mt-1 text-sm text-slate-500">These rules run before cohort randomisation.</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {exclusionRows.map((row) => (
                    <div key={row.reason} className="grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                      <div className="flex items-center gap-3">
                        <StatusDot className={row.tone.includes("red") ? "bg-red-500" : row.tone.includes("amber") ? "bg-amber-500" : "bg-slate-400"} />
                        <span className="text-sm font-medium">{row.reason}</span>
                      </div>
                      <span className={cn("pl-5 text-sm sm:pl-0 sm:text-right", row.tone)}>{row.handling}</span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="rounded-[8px] border border-orange-200 bg-[#fff7f2] p-5">
                <AlertTriangle className="h-5 w-5 text-[#d95700]" />
                <h3 className="mt-3 font-semibold">Fail closed</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Missing consent, unknown support status, ambiguous satisfaction, or an unavailable frequency history blocks the customer automatically.
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[#b34800]">
                  <ShieldCheck className="h-4 w-4" />
                  Manual review cannot bypass consent
                </div>
              </aside>
            </section>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">Message templates</h3>
                <p className="text-sm text-slate-500">Draft copy for Meta approval and internal testing.</p>
              </div>
              <Button className="gap-2" disabled variant="outline">
                <FileText className="h-4 w-4" />
                New template
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {templates.map((template) => (
                <article key={template.name} className="flex min-h-[260px] flex-col rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{template.name}</p>
                      <p className="mt-1 text-xs font-medium text-[#d95700]">{template.intent}</p>
                    </div>
                    <Badge variant="secondary">{template.status}</Badge>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-6 text-slate-700">{template.message}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                    <span className="flex items-center gap-2 text-slate-500">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Opt-out link included
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </article>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default Marketing;
