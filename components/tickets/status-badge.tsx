import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  OPEN: {
    label: "Aberta",
    className:
      "border-emerald-300/60 bg-emerald-200/40 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-700/30 dark:text-emerald-100",
  },
  PENDING: {
    label: "Pendente",
    className:
      "border-amber-300/60 bg-amber-200/40 text-amber-900 dark:border-amber-500/50 dark:bg-amber-700/30 dark:text-amber-100",
  },
  RESOLVED: {
    label: "Resolvida",
    className:
      "border-blue-300/60 bg-blue-200/40 text-blue-900 dark:border-blue-500/50 dark:bg-blue-700/30 dark:text-blue-100",
  },
  SNOOZED: {
    label: "Pausada",
    className:
      "border-zinc-300/70 bg-zinc-200/50 text-zinc-900 dark:border-zinc-500/50 dark:bg-zinc-700/30 dark:text-zinc-100",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "border-border",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
