import type { RefObject } from "react";
import {
  ChevronDown,
  Filter,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import type { IssueStatus, IssueView } from "../../types";
import { issueStatuses } from "../../types";

interface IssueToolbarProps {
  view: IssueView;
  query: string;
  statusFilter: IssueStatus | "All";
  searchInput: RefObject<HTMLInputElement>;
  onViewChange: (view: IssueView) => void;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: IssueStatus | "All") => void;
  onClearFilters: () => void;
}

export function IssueToolbar({
  view,
  query,
  statusFilter,
  searchInput,
  onViewChange,
  onQueryChange,
  onStatusFilterChange,
  onClearFilters,
}: IssueToolbarProps) {
  return (
    <div className="board-toolbar">
      <div className="view-tabs" role="group" aria-label="Issue view">
        <button
          type="button"
          className={view === "board" ? "view-tab active" : "view-tab"}
          onClick={() => onViewChange("board")}
          aria-pressed={view === "board"}
        >
          <LayoutGrid size={15} /> Board
        </button>
        <button
          type="button"
          className={view === "list" ? "view-tab active" : "view-tab"}
          onClick={() => onViewChange("list")}
          aria-pressed={view === "list"}
        >
          <List size={15} /> List
        </button>
      </div>
      <div className="toolbar-controls">
        <label className="search-box">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search issues..."
            value={query}
            ref={searchInput}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Search issues"
          />
          <kbd>⌘ K</kbd>
        </label>
        <label className="filter-control">
          <Filter size={15} />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(event.target.value as IssueStatus | "All")
            }
          >
            <option value="All">All statuses</option>
            {issueStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <button
          className="icon-button toolbar-filter"
          type="button"
          aria-label="Clear filters"
          title="Clear search and filters"
          onClick={onClearFilters}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
