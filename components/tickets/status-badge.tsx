import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline";
    className: string;
  }
> = {
  OPEN: {
    label: "Aberta",
    variant: "outline",
    className:
      "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  PENDING: {
    label: "Pendente",
    variant: "outline",
    className:
      "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  RESOLVED: {
    label: "Resolvida",
    variant: "outline",
    className: "border-sky-500/45 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  SNOOZED: {
    label: "Pausada",
    variant: "outline",
    className:
      "border-slate-500/45 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    variant: "outline" as const,
    className: "",
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
