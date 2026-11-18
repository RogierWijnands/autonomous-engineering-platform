import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CirclePlus, Pencil } from "lucide-react";
import { IssueDialog } from "./components/issues/IssueDialog";
import { IssueBoard } from "./components/issues/IssueBoard";
import { IssueDetailPanel } from "./components/issues/IssueDetailPanel";
import { IssueList } from "./components/issues/IssueList";
import { MakeSubtaskDialog } from "./components/issues/MakeSubtaskDialog";
import { MakeStandaloneDialog } from "./components/issues/MakeStandaloneDialog";
import { IssueToolbar } from "./components/issues/IssueToolbar";
import { ProjectSummary } from "./components/issues/ProjectSummary";
import { ProjectDialog } from "./components/projects/ProjectDialog";
import { ProjectSidebar } from "./components/projects/ProjectSidebar";
import { DeleteDialog } from "./components/common/DeleteDialog";
import { projectIssuePrefix } from "./utils/projectIssuePrefix";
import { request, type Snapshot } from "./api";
import {
  issueStatuses,
  type IssueStatus,
  type IssueView,
  type Project,
  type ProjectDraft,
  type Issue,
  type IssueDraft,
} from "./types";

type ProjectDialogState =
  { mode: "create" } | { mode: "edit"; project: Project } | null;

type MakeSubtaskState = {
  issueKey: string;
  parentKey?: string;
  fromDetail: boolean;
} | null;

type MakeStandaloneState = {
  issueKey: string;
  initialStatus: IssueStatus;
  fromDetail: boolean;
} | null;

type DeleteState =
  | { kind: "project"; project: Project; issueKeys: string[] }
  | { kind: "issue"; issue: Issue; subtaskKeys: string[] }
  | null;

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const pending = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const projectHeadingRef = useRef<HTMLHeadingElement>(null);
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusFirstProject = useRef(false);
  const focusAfterIssueDelete = useRef(false);
  const focusAfterProjectDelete = useRef(false);
  const [expandedStoryKeys, setExpandedStoryKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [focusEditAction, setFocusEditAction] = useState(false);
  const [focusSubtaskAction, setFocusSubtaskAction] = useState(false);
  const [focusStandaloneAction, setFocusStandaloneAction] = useState(false);
  const [makeSubtaskDialog, setMakeSubtaskDialog] =
    useState<MakeSubtaskState>(null);
  const [makeStandaloneDialog, setMakeStandaloneDialog] =
    useState<MakeStandaloneState>(null);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [subtaskParentIssue, setSubtaskParentIssue] = useState<Issue | null>(
    null,
  );
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteState>(null);
  const [focusDeleteAction, setFocusDeleteAction] = useState(false);
  const [projectDeleteDraft, setProjectDeleteDraft] = useState("");
  const [view, setView] = useState<IssueView>("board");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "All">("All");
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  async function loadData() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await request<Snapshot>("state");
      setProjects(data.projects);
      setIssues(data.issues);
      setSelectedProjectId((current) => current || data.projects[0]?.id || "");
      setLoaded(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load simulator data.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useLayoutEffect(() => {
    if (!loaded || !loading || !shellRef.current) return;
    const shell = shellRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    shell.inert = true;
    loadingRef.current?.focus();
    const blockKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", blockKeys, true);
    return () => {
      document.removeEventListener("keydown", blockKeys, true);
      shell.inert = false;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [loaded, loading]);

  async function mutate<T extends Snapshot>(
    path: string,
    data: object,
    onSuccess?: (result: T) => void,
  ): Promise<T | undefined> {
    if (pending.current) return undefined;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await request<T>(path, data);
      onSuccess?.(result);
      setProjects(result.projects);
      setIssues(result.issues);
      return result;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save simulator data.",
      );
      return undefined;
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  useLayoutEffect(() => {
    if (focusFirstProject.current && selectedProject) {
      projectHeadingRef.current?.focus();
      focusFirstProject.current = false;
    }
  }, [selectedProject]);
  useLayoutEffect(() => {
    if (focusAfterProjectDelete.current) {
      const heading = selectedProject
        ? projectHeadingRef.current
        : emptyHeadingRef.current;
      if (heading) {
        heading.focus();
        focusAfterProjectDelete.current = false;
      }
    }
    if (
      focusAfterIssueDelete.current &&
      !selectedIssue &&
      searchInput.current
    ) {
      searchInput.current.focus();
      focusAfterIssueDelete.current = false;
    }
  }, [selectedProject, selectedIssue, projects.length]);
  const projectIssues = useMemo(
    () => issues.filter((issue) => issue.projectId === selectedProjectId),
    [issues, selectedProjectId],
  );

  const filteredIssues = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();
    return projectIssues.filter((issue) => {
      const matchesQuery =
        searchTerm.length === 0 ||
        [issue.key, issue.summary, issue.description, ...issue.labels]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);
      return (
        matchesQuery &&
        (statusFilter === "All" || issue.status === statusFilter)
      );
    });
  }, [projectIssues, query, statusFilter]);
  const filterKey =
    query.trim() || statusFilter !== "All"
      ? JSON.stringify([query.trim().toLowerCase(), statusFilter])
      : null;
  const matchingIssueKeys = new Set(filteredIssues.map((issue) => issue.key));
  const matchingParentKeys = new Set(
    filteredIssues.flatMap((issue) =>
      issue.parentIssueKey ? [issue.parentIssueKey] : [],
    ),
  );
  const matchingSubtaskCount = filteredIssues.filter(
    (issue) => issue.parentIssueKey,
  ).length;
  const visibleIssues =
    view === "board"
      ? projectIssues.filter(
          (issue) =>
            !issue.parentIssueKey &&
            (matchingIssueKeys.has(issue.key) ||
              matchingParentKeys.has(issue.key)),
        )
      : filteredIssues;
  const totalVisibleIssues =
    view === "board"
      ? projectIssues.filter((issue) => !issue.parentIssueKey).length
      : projectIssues.length;
  const makeSubtaskIssue = makeSubtaskDialog
    ? projectIssues.find((issue) => issue.key === makeSubtaskDialog.issueKey)
    : undefined;
  if (makeSubtaskDialog && !makeSubtaskIssue) {
    throw new Error(
      "Cannot make an issue a subtask outside the current project.",
    );
  }
  const standaloneIssue = makeStandaloneDialog
    ? projectIssues.find((issue) => issue.key === makeStandaloneDialog.issueKey)
    : undefined;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey) &&
        !isCreateIssueOpen &&
        !selectedIssue &&
        !projectDialog &&
        !subtaskParentIssue &&
        !makeSubtaskDialog &&
        !makeStandaloneDialog &&
        !deleteDialog
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    isCreateIssueOpen,
    projectDialog,
    selectedIssue,
    subtaskParentIssue,
    makeSubtaskDialog,
    makeStandaloneDialog,
    deleteDialog,
  ]);

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedIssue(null);
    setQuery("");
    setStatusFilter("All");
  }

  function openIssue(issue: Issue) {
    setFocusEditAction(false);
    setFocusSubtaskAction(false);
    setFocusStandaloneAction(false);
    setFocusDeleteAction(false);
    setSelectedIssue(issue);
  }

  function closeIssueEditor() {
    setEditingIssue(null);
    setFocusEditAction(true);
  }

  function closeDeleteDialog() {
    setError("");
    setFocusDeleteAction(true);
    setDeleteDialog(null);
  }

  async function confirmDelete() {
    if (!deleteDialog) throw new Error("Cannot delete without a confirmation.");
    const target = deleteDialog;
    const path =
      target.kind === "project" ? "projects/delete" : "issues/delete";
    const data =
      target.kind === "project"
        ? { id: target.project.id, issueKeys: target.issueKeys }
        : { key: target.issue.key, subtaskKeys: target.subtaskKeys };
    await mutate<Snapshot>(path, data, (result) => {
      setDeleteDialog(null);
      setFocusDeleteAction(false);
      if (target.kind === "project") {
        setProjectDialog(null);
        setSelectedIssue(null);
        setSelectedProjectId(result.projects[0]?.id ?? "");
        setExpandedStoryKeys(new Set());
        setQuery("");
        setStatusFilter("All");
        setView("board");
        setStatusAnnouncement(`Project ${target.project.name} deleted.`);
        focusAfterProjectDelete.current = true;
      } else {
        setSelectedIssue(null);
        setExpandedStoryKeys((current) => {
          const updated = new Set(current);
          updated.delete(target.issue.key);
          return updated;
        });
        setStatusAnnouncement(`Issue ${target.issue.key} deleted.`);
        focusAfterIssueDelete.current = true;
      }
    });
  }

  async function saveProject(draft: ProjectDraft) {
    if (projectDialog?.mode === "edit") {
      const editedProject = projectDialog.project;
      const previousPrefix = projectIssuePrefix(editedProject.name);
      const updatedPrefix = projectIssuePrefix(draft.name);
      const result = await mutate<Snapshot>("projects/update", {
        id: editedProject.id,
        name: draft.name,
      });
      if (!result) return;
      if (previousPrefix !== updatedPrefix) {
        setExpandedStoryKeys((current) => {
          const updated = new Set(current);
          for (const issue of issues) {
            if (
              issue.projectId === editedProject.id &&
              current.has(issue.key)
            ) {
              updated.delete(issue.key);
              updated.add(
                `${updatedPrefix}${issue.key.slice(previousPrefix.length)}`,
              );
            }
          }
          return updated;
        });
      }
    } else if (projectDialog?.mode === "create") {
      const result = await mutate<Snapshot & { project: Project }>(
        "projects/create",
        draft,
      );
      if (!result) return;
      focusFirstProject.current = projects.length === 0;
      setSelectedProjectId(result.project.id);
      setSelectedIssue(null);
      setQuery("");
      setStatusFilter("All");
      setView("board");
    } else {
      throw new Error("Cannot save a project when its dialog is closed.");
    }

    setProjectDialog(null);
  }

  async function addIssue(draft: IssueDraft, parentIssueKey?: string) {
    if (!selectedProject) {
      throw new Error("Cannot create an issue without a selected project.");
    }

    const result = await mutate<Snapshot & { issue: Issue }>("issues/create", {
      projectId: selectedProject.id,
      draft,
      parentIssueKey,
    });
    if (!result) return undefined;
    setStatusFilter("All");
    setQuery("");
    return result.issue;
  }

  async function createIssue(draft: IssueDraft) {
    const newIssue = await addIssue(draft);
    if (!newIssue) return;
    setIsCreateIssueOpen(false);
    openIssue(newIssue);
  }

  function openSubtaskDialog(parentIssue: Issue) {
    if (parentIssue.issueType !== "Story") {
      throw new Error("Only Story issues can have subtasks.");
    }
    setSubtaskParentIssue(parentIssue);
    setFocusEditAction(false);
    setFocusSubtaskAction(false);
    setSelectedIssue(null);
  }

  function closeSubtaskDialog() {
    setSelectedIssue(subtaskParentIssue);
    setSubtaskParentIssue(null);
  }

  async function createSubtask(parentIssue: Issue, draft: IssueDraft) {
    const currentParent = projectIssues.find(
      (issue) => issue.key === parentIssue.key,
    );
    if (
      !currentParent ||
      currentParent.issueType !== "Story" ||
      draft.issueType !== "Task"
    ) {
      throw new Error(
        "A subtask must be a Task under a Story in this project.",
      );
    }

    const created = await addIssue(draft, currentParent.key);
    if (!created) return;
    setSubtaskParentIssue(null);
    setSelectedIssue(currentParent);
  }

  async function updateIssue(updatedIssue: Issue) {
    const currentIssue = projectIssues.find(
      (issue) => issue.key === updatedIssue.key,
    );
    if (
      !currentIssue ||
      (currentIssue.parentIssueKey && updatedIssue.issueType !== "Task")
    ) {
      throw new Error(
        "Cannot update an issue outside its project or change a subtask's type.",
      );
    }
    const result = await mutate<Snapshot>("issues/update", {
      issue: updatedIssue,
    });
    if (!result) return false;
    if (currentIssue.status !== updatedIssue.status) {
      setStatusAnnouncement(
        `Issue ${updatedIssue.key} moved to ${updatedIssue.status}.`,
      );
    }
    setSelectedIssue(updatedIssue);
    return true;
  }

  async function moveIssue(issueKey: string, status: IssueStatus) {
    const movedIssue = projectIssues.find((issue) => issue.key === issueKey);
    if (!movedIssue) {
      throw new Error("Cannot move an issue outside the current project.");
    }
    if (movedIssue.parentIssueKey) {
      startMakeStandalone(issueKey, status, false);
      return;
    }
    if (movedIssue.status === status) return;
    const result = await mutate<Snapshot>("issues/update", {
      issue: { ...movedIssue, status },
    });
    if (result) {
      setStatusAnnouncement(`Issue ${issueKey} moved to ${status}.`);
    }
  }

  function startMakeStandalone(
    issueKey: string,
    status: IssueStatus,
    fromDetail: boolean,
  ) {
    const source = projectIssues.find((issue) => issue.key === issueKey);
    if (!source?.parentIssueKey || !issueStatuses.includes(status)) {
      throw new Error(
        "A standalone task must come from a subtask in this project with a valid status.",
      );
    }
    setFocusEditAction(false);
    setFocusSubtaskAction(false);
    setFocusStandaloneAction(false);
    setMakeStandaloneDialog({ issueKey, initialStatus: status, fromDetail });
  }

  function closeMakeStandalone() {
    setFocusStandaloneAction(Boolean(makeStandaloneDialog?.fromDetail));
    setMakeStandaloneDialog(null);
  }

  async function confirmMakeStandalone(status: IssueStatus) {
    if (!standaloneIssue?.parentIssueKey || !issueStatuses.includes(status)) {
      throw new Error(
        "Cannot confirm a standalone task without a valid subtask and status.",
      );
    }
    const { parentIssueKey: _parentIssueKey, ...standalone } = standaloneIssue;
    const updatedIssue = { ...standalone, status };
    const result = await mutate<Snapshot>("issues/standalone", {
      key: updatedIssue.key,
      status,
    });
    if (!result) return;
    if (makeStandaloneDialog?.fromDetail) {
      setFocusStandaloneAction(false);
      setSelectedIssue(updatedIssue);
    }
    setStatusAnnouncement(
      `Issue ${updatedIssue.key} is now a standalone Task in ${status}.`,
    );
    setMakeStandaloneDialog(null);
  }

  function startMakeSubtask(
    issueKey: string,
    parentKey?: string,
    fromDetail = false,
  ) {
    const source = projectIssues.find((issue) => issue.key === issueKey);
    const parent = parentKey
      ? projectIssues.find((issue) => issue.key === parentKey)
      : undefined;
    if (
      !source ||
      (parentKey &&
        (!parent ||
          parent.parentIssueKey ||
          parent.key === source.key ||
          parent.key === source.parentIssueKey))
    ) {
      throw new Error(
        "A subtask must have a different top-level parent in this project.",
      );
    }
    setFocusEditAction(false);
    setFocusSubtaskAction(false);
    setFocusStandaloneAction(false);
    setMakeSubtaskDialog({ issueKey, parentKey, fromDetail });
  }

  function closeMakeSubtask() {
    setFocusSubtaskAction(Boolean(makeSubtaskDialog?.fromDetail));
    setMakeSubtaskDialog(null);
  }

  async function confirmMakeSubtask(parentKey: string) {
    const source = makeSubtaskIssue;
    const parent = projectIssues.find((issue) => issue.key === parentKey);
    if (
      !source ||
      !parent ||
      parent.parentIssueKey ||
      source.key === parent.key ||
      source.parentIssueKey === parent.key
    ) {
      throw new Error(
        "A subtask must have a different top-level parent in this project.",
      );
    }
    const updatedSource: Issue = {
      ...source,
      issueType: "Task",
      parentIssueKey: parent.key,
    };
    const result = await mutate<Snapshot>("issues/subtask", {
      key: source.key,
      parentKey,
    });
    if (!result) return;
    if (makeSubtaskDialog?.fromDetail) openIssue(updatedSource);
    setStatusAnnouncement(
      `Issue ${source.key} is now a subtask of ${parent.key}.`,
    );
    setMakeSubtaskDialog(null);
  }

  if (!loaded) {
    return (
      <main className="app-shell">
        {loading && (
          <p className="loading-message" role="status">
            Loading simulator data...
          </p>
        )}
        {error && (
          <div role="alert" className="app-error">
            {error}{" "}
            <button type="button" onClick={() => void loadData()}>
              Retry
            </button>
          </div>
        )}
      </main>
    );
  }

  if (!selectedProject && projects.length === 0) {
    return (
      <>
        {loading && (
          <div
            className="loading-overlay"
            ref={loadingRef}
            tabIndex={-1}
            role="status"
          >
            Loading, please wait...
          </div>
        )}
        {error && !projectDialog && (
          <div className="request-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        <div className="app-shell" ref={shellRef}>
          <ProjectSidebar
            projects={projects}
            selectedProjectId=""
            onSelectProject={selectProject}
            onCreateProject={() => setProjectDialog({ mode: "create" })}
          />
          <main className="main-panel">
            <div className="page-content empty-projects">
              <p className="visually-hidden" role="status" aria-atomic="true">
                {statusAnnouncement}
              </p>
              <h1 ref={emptyHeadingRef} tabIndex={-1}>
                No projects yet
              </h1>
              <p>Create your first project to start tracking issues.</p>
              <button
                className="primary-button"
                type="button"
                onClick={() => setProjectDialog({ mode: "create" })}
              >
                <CirclePlus size={17} /> Create your first project
              </button>
            </div>
          </main>
          {projectDialog && (
            <ProjectDialog
              projects={projects}
              requestError={error}
              onSave={saveProject}
              onClose={() => setProjectDialog(null)}
            />
          )}
        </div>
      </>
    );
  }

  if (!selectedProject) {
    return (
      <main className="app-shell">
        <p className="app-error" role="alert">
          The selected project could not be found.
        </p>
      </main>
    );
  }

  return (
    <>
      {loading && (
        <div
          className="loading-overlay"
          ref={loadingRef}
          tabIndex={-1}
          role="status"
        >
          Loading, please wait...
        </div>
      )}
      {error &&
        !selectedIssue &&
        !editingIssue &&
        !makeSubtaskDialog &&
        !makeStandaloneDialog &&
        !isCreateIssueOpen &&
        !subtaskParentIssue &&
        !projectDialog &&
        !deleteDialog && (
          <div className="request-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
      <div className="app-shell" ref={shellRef}>
        <ProjectSidebar
          projects={projects}
          selectedProjectId={selectedProject.id}
          onSelectProject={selectProject}
          onCreateProject={() => setProjectDialog({ mode: "create" })}
        />

        <main className="main-panel">
          <div className="page-content">
            <p className="visually-hidden" role="status" aria-atomic="true">
              {statusAnnouncement}
            </p>
            <section className="page-heading">
              <div className="page-title">
                <h1 ref={projectHeadingRef} tabIndex={-1}>
                  {selectedProject.name}
                </h1>
                <button
                  className="icon-button edit-project-button"
                  type="button"
                  aria-label="Edit project"
                  title="Edit project"
                  onClick={() => {
                    setFocusDeleteAction(false);
                    setProjectDialog({
                      mode: "edit",
                      project: selectedProject,
                    });
                  }}
                >
                  <Pencil size={15} />
                </button>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsCreateIssueOpen(true)}
              >
                <CirclePlus size={17} />
                Create issue
              </button>
            </section>

            <ProjectSummary issues={projectIssues} />

            <section className="board-section">
              <IssueToolbar
                view={view}
                query={query}
                statusFilter={statusFilter}
                searchInput={searchInput}
                onViewChange={setView}
                onQueryChange={setQuery}
                onStatusFilterChange={setStatusFilter}
                onClearFilters={() => {
                  setQuery("");
                  setStatusFilter("All");
                }}
              />

              {view === "board" ? (
                <IssueBoard
                  issues={visibleIssues}
                  projectIssues={projectIssues}
                  filteredIssues={filteredIssues}
                  filterKey={filterKey}
                  expandedStoryKeys={expandedStoryKeys}
                  onExpandedChange={(issueKey, expanded) => {
                    setExpandedStoryKeys((current) => {
                      const updated = new Set(current);
                      if (expanded) updated.add(issueKey);
                      else updated.delete(issueKey);
                      return updated;
                    });
                  }}
                  onOpenIssue={openIssue}
                  onCreateIssue={() => setIsCreateIssueOpen(true)}
                  onMoveIssue={moveIssue}
                  onMakeSubtask={(issueKey, parentKey) =>
                    startMakeSubtask(issueKey, parentKey)
                  }
                />
              ) : (
                <IssueList
                  issues={visibleIssues}
                  hasSubtasks={projectIssues.some((issue) =>
                    Boolean(issue.parentIssueKey),
                  )}
                  onOpenIssue={openIssue}
                />
              )}
              <div
                className="board-footer"
                aria-live="polite"
                aria-atomic="true"
              >
                <span>
                  Showing <strong>{visibleIssues.length}</strong> of{" "}
                  {totalVisibleIssues}{" "}
                  {view === "board" && filterKey
                    ? "top-level issues"
                    : "issues"}
                  {view === "board" && filterKey && (
                    <>
                      {" "}
                      · {matchingSubtaskCount} matching{" "}
                      {matchingSubtaskCount === 1 ? "subtask" : "subtasks"}
                    </>
                  )}
                </span>
              </div>
            </section>
          </div>
        </main>

        {selectedIssue &&
          !editingIssue &&
          !makeSubtaskDialog &&
          !makeStandaloneDialog &&
          !deleteDialog && (
            <IssueDetailPanel
              key={selectedIssue.key}
              issue={selectedIssue}
              requestError={error}
              parentIssue={
                selectedIssue.parentIssueKey
                  ? projectIssues.find(
                      (issue) => issue.key === selectedIssue.parentIssueKey,
                    )
                  : undefined
              }
              subtasks={projectIssues.filter(
                (issue) =>
                  issue.issueType === "Task" &&
                  issue.parentIssueKey === selectedIssue.key,
              )}
              projectName={selectedProject.name}
              focusEditAction={focusEditAction}
              focusSubtaskAction={focusSubtaskAction}
              focusStandaloneAction={focusStandaloneAction}
              focusDeleteAction={focusDeleteAction}
              fallbackFocusRef={searchInput}
              canMakeSubtask={projectIssues.some(
                (issue) =>
                  !issue.parentIssueKey &&
                  issue.key !== selectedIssue.key &&
                  issue.key !== selectedIssue.parentIssueKey,
              )}
              onClose={() => setSelectedIssue(null)}
              onUpdate={updateIssue}
              onEdit={setEditingIssue}
              onDelete={(issue) => {
                setFocusEditAction(false);
                setFocusSubtaskAction(false);
                setFocusStandaloneAction(false);
                setFocusDeleteAction(false);
                setDeleteDialog({
                  kind: "issue",
                  issue,
                  subtaskKeys: projectIssues
                    .filter((item) => item.parentIssueKey === issue.key)
                    .map((item) => item.key),
                });
              }}
              onMakeSubtask={(issue) =>
                startMakeSubtask(issue.key, undefined, true)
              }
              onMakeStandalone={(issue) =>
                startMakeStandalone(issue.key, issue.status, true)
              }
              onCreateSubtask={openSubtaskDialog}
              onOpenIssue={openIssue}
            />
          )}

        {makeSubtaskDialog && makeSubtaskIssue && (
          <MakeSubtaskDialog
            issue={makeSubtaskIssue}
            requestError={error}
            candidates={projectIssues.filter(
              (issue) =>
                !issue.parentIssueKey &&
                issue.key !== makeSubtaskIssue.key &&
                issue.key !== makeSubtaskIssue.parentIssueKey,
            )}
            initialParentKey={makeSubtaskDialog.parentKey}
            hasSubtasks={projectIssues.some(
              (issue) => issue.parentIssueKey === makeSubtaskIssue.key,
            )}
            onConfirm={confirmMakeSubtask}
            onClose={closeMakeSubtask}
          />
        )}

        {makeStandaloneDialog && standaloneIssue?.parentIssueKey && (
          <MakeStandaloneDialog
            issue={standaloneIssue}
            requestError={error}
            initialStatus={makeStandaloneDialog.initialStatus}
            fallbackFocusRef={searchInput}
            onConfirm={confirmMakeStandalone}
            onClose={closeMakeStandalone}
          />
        )}

        {isCreateIssueOpen && (
          <IssueDialog
            project={selectedProject}
            requestError={error}
            onSave={createIssue}
            onClose={() => setIsCreateIssueOpen(false)}
          />
        )}

        {subtaskParentIssue && (
          <IssueDialog
            project={selectedProject}
            requestError={error}
            parentIssue={subtaskParentIssue}
            onSave={(draft) => createSubtask(subtaskParentIssue, draft)}
            onClose={closeSubtaskDialog}
          />
        )}

        {editingIssue && (
          <IssueDialog
            project={selectedProject}
            requestError={error}
            issue={editingIssue}
            hasSubtasks={projectIssues.some(
              (issue) => issue.parentIssueKey === editingIssue.key,
            )}
            onSave={async (draft) => {
              if (await updateIssue({ ...editingIssue, ...draft }))
                closeIssueEditor();
            }}
            onClose={closeIssueEditor}
          />
        )}

        {projectDialog && !deleteDialog && (
          <ProjectDialog
            key={
              projectDialog.mode === "edit"
                ? projectDialog.project.id
                : "create-project"
            }
            project={
              projectDialog.mode === "edit" ? projectDialog.project : undefined
            }
            projects={projects}
            requestError={error}
            focusDeleteAction={focusDeleteAction}
            initialName={focusDeleteAction ? projectDeleteDraft : undefined}
            onDelete={
              projectDialog.mode === "edit"
                ? (draftName) => {
                    setProjectDeleteDraft(draftName);
                    setFocusDeleteAction(false);
                    setDeleteDialog({
                      kind: "project",
                      project: projectDialog.project,
                      issueKeys: projectIssues.map((issue) => issue.key),
                    });
                  }
                : undefined
            }
            onSave={saveProject}
            onClose={() => setProjectDialog(null)}
          />
        )}
        {deleteDialog && (
          <DeleteDialog
            kind={deleteDialog.kind}
            name={
              deleteDialog.kind === "project"
                ? deleteDialog.project.name
                : `${deleteDialog.issue.key}: ${deleteDialog.issue.summary}`
            }
            relatedCount={
              deleteDialog.kind === "project"
                ? deleteDialog.issueKeys.length
                : deleteDialog.subtaskKeys.length
            }
            requestError={error}
            onConfirm={() => void confirmDelete()}
            onClose={closeDeleteDialog}
          />
        )}
      </div>
    </>
  );
}

export default App;
