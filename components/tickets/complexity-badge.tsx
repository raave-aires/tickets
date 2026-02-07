import { Badge } from "@/components/ui/badge";

type ComplexityBadgeProps = {
  complexity: string;
};

const complexityConfig: Record<string, { label: string; className: string }> = {
  LOW: {
    label: "Baixa",
    className:
      "border-green-300/60 bg-green-100/80 text-green-800 dark:border-green-500/50 dark:bg-green-800/30 dark:text-green-100",
  },
  MEDIUM: {
    label: "Media",
    className:
      "border-yellow-300/60 bg-yellow-100/80 text-yellow-800 dark:border-yellow-500/50 dark:bg-yellow-800/30 dark:text-yellow-100",
  },
  HIGH: {
    label: "Alta",
    className:
      "border-orange-300/60 bg-orange-100/80 text-orange-800 dark:border-orange-500/50 dark:bg-orange-800/30 dark:text-orange-100",
  },
  CRITICAL: {
    label: "Critica",
    className:
      "border-red-300/60 bg-red-100/80 text-red-800 dark:border-red-500/50 dark:bg-red-800/30 dark:text-red-100",
  },
};

export function ComplexityBadge({ complexity }: ComplexityBadgeProps) {
  const config = complexityConfig[complexity] ?? {
    label: complexity,
    className: "border-border",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
