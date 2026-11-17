import { ArrowDown, ArrowDownRight, ArrowUp } from "lucide-react";
import type { Priority } from "../../types";

interface PriorityIconProps {
  priority: Priority;
}

export function PriorityIcon({ priority }: PriorityIconProps) {
  const Icon =
    priority === "Highest" || priority === "High"
      ? ArrowUp
      : priority === "Low"
        ? ArrowDown
        : ArrowDownRight;

  return (
    <Icon
      className={`priority-icon priority-${priority.toLowerCase()}`}
      size={15}
    />
  );
}
