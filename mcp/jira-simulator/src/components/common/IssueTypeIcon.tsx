import { Bug, CircleDot, ListChecks } from "lucide-react";
import type { IssueType } from "../../types";

interface IssueTypeIconProps {
  type: IssueType;
}

export function IssueTypeIcon({ type }: IssueTypeIconProps) {
  const Icon = type === "Story" ? CircleDot : type === "Bug" ? Bug : ListChecks;

  return (
    <span className={`issue-type-icon issue-type-${type.toLowerCase()}`}>
      <Icon size={11} strokeWidth={2.2} />
    </span>
  );
}
