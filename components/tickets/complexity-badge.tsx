import { Badge } from "@/components/ui/badge";

type ComplexityBadgeProps = {
  complexity: string;
};

const complexityConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline";
    className: string;
  }
> = {
  LOW: {
    label: "Baixa",
    variant: "outline",
    className:
      "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  MEDIUM: {
    label: "Media",
    variant: "outline",
    className:
      "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  HIGH: {
    label: "Alta",
    variant: "outline",
    className:
      "border-orange-500/45 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  CRITICAL: {
    label: "Critica",
    variant: "outline",
    className:
      "border-rose-500/45 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

export function ComplexityBadge({ complexity }: ComplexityBadgeProps) {
  const config = complexityConfig[complexity] ?? {
    label: complexity,
    variant: "outline" as const,
    className: "",
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
