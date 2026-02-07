"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type HistoryStatusFilterValue =
  | "ALL"
  | "OPEN"
  | "PENDING"
  | "RESOLVED"
  | "SNOOZED";

const statusOptions: { value: HistoryStatusFilterValue; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Aberta" },
  { value: "PENDING", label: "Pendente" },
  { value: "RESOLVED", label: "Resolvida" },
  { value: "SNOOZED", label: "Pausada" },
];

type HistoryStatusFilterProps = {
  value: HistoryStatusFilterValue;
};

export function HistoryStatusFilter({ value }: HistoryStatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(nextValue: HistoryStatusFilterValue) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextValue === "ALL") {
      params.delete("status");
    } else {
      params.set("status", nextValue);
    }

    const query = params.toString();

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="w-full space-y-1.5 sm:w-56">
      <Label htmlFor="history-status-filter">Filtrar por status</Label>
      <Select
        value={value}
        onValueChange={(selected) =>
          handleStatusChange(selected as HistoryStatusFilterValue)
        }
        disabled={isPending}
      >
        <SelectTrigger id="history-status-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
