import { Badge } from "@/client/components/ui/badge";

const LOOK = {
  done: { label: "Done", variant: "default" },
  partial: { label: "Partial", variant: "secondary" },
  missed: { label: "Missed", variant: "destructive" },
  pending: { label: "To do", variant: "outline" },
} as const;

export function StateBadge({ state }: { state: keyof typeof LOOK }) {
  const look = LOOK[state];
  return <Badge variant={look.variant}>{look.label}</Badge>;
}

const STATUS = {
  solved: { label: "Solved", variant: "default" },
  partial: { label: "Partial", variant: "secondary" },
  stuck: { label: "Stuck", variant: "destructive" },
  skipped: { label: "Skipped", variant: "outline" },
} as const;

export type AttemptStatus = keyof typeof STATUS;
export const statusLabel = (status: AttemptStatus) => STATUS[status].label;

export function StatusBadge({
  status,
  ...rest
}: {
  status: AttemptStatus | null;
  "data-testid"?: string;
}) {
  if (!status)
    return (
      <Badge variant="outline" {...rest}>
        Not tried
      </Badge>
    );
  return (
    <Badge variant={STATUS[status].variant} {...rest}>
      {STATUS[status].label}
    </Badge>
  );
}
