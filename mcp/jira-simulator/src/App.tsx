import { useEffect, useMemo, useRef, useState } from "react";
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
import { initialProjects } from "./data/projects";
import { initialIssues } from "./data/issues";
import { projectIssuePrefix } from "./utils/projectIssuePrefix";
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
  | { mode: "create" }
  | { mode: "edit"; project: Project }
  | null;

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

function App() {
  const [projects, setProjects] = useState(initialProjects);
  const [issues, setIssues] = useState(initialIssues);
  const [expandedStoryKeys, setExpandedStoryKeys] = useState<Set<string>>(() => new Set());
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [focusEditAction, setFocusEditAction] = useState(false);
  const [focusSubtaskAction, setFocusSubtaskAction] = useState(false);
  const [focusStandaloneAction, setFocusStandaloneAction] = useState(false);
  const [makeSubtaskDialog, setMakeSubtaskDialog] = useState<MakeSubtaskState>(null);
  const [makeStandaloneDialog, setMakeStandaloneDialog] = useState<MakeStandaloneState>(null);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [subtaskParentIssue, setSubtaskParentIssue] = useState<Issue | null>(null);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const [view, setView] = useState<IssueView>("board");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "All">("All");
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
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
  const filterKey = query.trim() || statusFilter !== "All"
    ? JSON.stringify([query.trim().toLowerCase(), statusFilter])
    : null;
  const matchingIssueKeys = new Set(filteredIssues.map((issue) => issue.key));
  const matchingParentKeys = new Set(
    filteredIssues.flatMap((issue) => issue.parentIssueKey ? [issue.parentIssueKey] : []),
  );
  const matchingSubtaskCount = filteredIssues.filter((issue) => issue.parentIssueKey).length;
  const visibleIssues =
    view === "board"
      ? projectIssues.filter(
          (issue) => !issue.parentIssueKey &&
            (matchingIssueKeys.has(issue.key) || matchingParentKeys.has(issue.key)),
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
    throw new Error("Cannot make an issue a subtask outside the current project.");
  }
  const standaloneIssue = makeStandaloneDialog
    ? projectIssues.find((issue) => issue.key === makeStandaloneDialog.issueKey)
    : undefined;
  if (makeStandaloneDialog && (!standaloneIssue || !standaloneIssue.parentIssueKey)) {
    throw new Error("Cannot make an issue standalone unless it is a subtask in this project.");
  }

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
        !makeStandaloneDialog
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isCreateIssueOpen, projectDialog, selectedIssue, subtaskParentIssue, makeSubtaskDialog, makeStandaloneDialog]);

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
    setSelectedIssue(issue);
  }

  function closeIssueEditor() {
    setEditingIssue(null);
    setFocusEditAction(true);
  }

  function saveProject(draft: ProjectDraft) {
    if (projectDialog?.mode === "edit") {
      const editedProject = projectDialog.project;
      const previousPrefix = projectIssuePrefix(editedProject.name);
      const updatedPrefix = projectIssuePrefix(draft.name);
      setProjects((current) =>
        current.map((project) =>
          project.id === editedProject.id
            ? { ...project, ...draft }
            : project,
        ),
      );
      if (previousPrefix !== updatedPrefix) {
        setExpandedStoryKeys((current) => {
          const updated = new Set(current);
          for (const issue of issues) {
            if (issue.projectId === editedProject.id && current.has(issue.key)) {
              updated.delete(issue.key);
              updated.add(`${updatedPrefix}${issue.key.slice(previousPrefix.length)}`);
            }
          }
          return updated;
        });
        setIssues((current) => {
          const updatedKeys = new Map(
            current
              .filter((issue) => issue.projectId === editedProject.id)
              .map((issue) => [
                issue.key,
                `${updatedPrefix}${issue.key.slice(previousPrefix.length)}`,
              ]),
          );
          return current.map((issue) => {
            if (issue.projectId !== editedProject.id) return issue;
            return {
              ...issue,
              key: updatedKeys.get(issue.key) ?? issue.key,
              ...(issue.parentIssueKey
                ? {
                    parentIssueKey:
                      updatedKeys.get(issue.parentIssueKey) ??
                      issue.parentIssueKey,
                  }
                : {}),
            };
          });
        });
      }
    } else if (projectDialog?.mode === "create") {
      const newProject: Project = {
        id: crypto.randomUUID(),
        ...draft,
      };
      setProjects((current) => [...current, newProject]);
      setSelectedProjectId(newProject.id);
      setSelectedIssue(null);
      setQuery("");
      setStatusFilter("All");
      setView("board");
    } else {
      throw new Error("Cannot save a project when its dialog is closed.");
    }

    setProjectDialog(null);
  }

  function addIssue(draft: IssueDraft, parentIssueKey?: string) {
    if (!selectedProject) {
      throw new Error("Cannot create an issue without a selected project.");
    }

    const latestNumber = projectIssues.reduce((latest, issue) => {
      const number = Number(issue.key.match(/\d+$/)?.[0] ?? 1000);
      return Math.max(latest, number);
    }, 1000);
    const newIssue: Issue = {
      ...draft,
      key: `${projectIssuePrefix(selectedProject.name)}-${latestNumber + 1}`,
      projectId: selectedProject.id,
      status: "To Do",
      ...(parentIssueKey ? { parentIssueKey } : {}),
    };

    setIssues((current) => [newIssue, ...current]);
    setStatusFilter("All");
    setQuery("");
    return newIssue;
  }

  function createIssue(draft: IssueDraft) {
    const newIssue = addIssue(draft);
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

  function createSubtask(parentIssue: Issue, draft: IssueDraft) {
    const currentParent = projectIssues.find(
      (issue) => issue.key === parentIssue.key,
    );
    if (
      !currentParent ||
      currentParent.issueType !== "Story" ||
      draft.issueType !== "Task"
    ) {
      throw new Error("A subtask must be a Task under a Story in this project.");
    }

    addIssue(draft, currentParent.key);
    setSubtaskParentIssue(null);
    setSelectedIssue(currentParent);
  }

  function updateIssue(updatedIssue: Issue) {
    const currentIssue = projectIssues.find(
      (issue) => issue.key === updatedIssue.key,
    );
    if (!currentIssue || (currentIssue.parentIssueKey && updatedIssue.issueType !== "Task")) {
      throw new Error("Cannot update an issue outside its project or change a subtask's type.");
    }
    if (currentIssue.status !== updatedIssue.status) {
      setStatusAnnouncement(
        `Issue ${updatedIssue.key} moved to ${updatedIssue.status}.`,
      );
    }
    setIssues((current) =>
      current.map((issue) => {
        if (issue.projectId !== selectedProjectId) return issue;
        if (issue.key === updatedIssue.key) return updatedIssue;
        if (
          currentIssue.issueType === "Story" &&
          updatedIssue.issueType !== "Story" &&
          issue.parentIssueKey === currentIssue.key
        ) {
          const { parentIssueKey: _parentIssueKey, ...standaloneIssue } = issue;
          return standaloneIssue;
        }
        return issue;
      }),
    );
    setSelectedIssue(updatedIssue);
  }

  function moveIssue(issueKey: string, status: IssueStatus) {
    const movedIssue = projectIssues.find((issue) => issue.key === issueKey);
    if (!movedIssue) {
      throw new Error("Cannot move an issue outside the current project.");
    }
    if (movedIssue.parentIssueKey) {
      startMakeStandalone(issueKey, status, false);
      return;
    }
    if (movedIssue.status !== status) {
      setStatusAnnouncement(`Issue ${issueKey} moved to ${status}.`);
    }
    setIssues((current) =>
      current.map((issue) =>
        issue.projectId === selectedProjectId && issue.key === issueKey
          ? { ...issue, status }
          : issue,
      ),
    );
  }

  function startMakeStandalone(issueKey: string, status: IssueStatus, fromDetail: boolean) {
    const source = projectIssues.find((issue) => issue.key === issueKey);
    if (!source?.parentIssueKey || !issueStatuses.includes(status)) {
      throw new Error("A standalone task must come from a subtask in this project with a valid status.");
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

  function confirmMakeStandalone(status: IssueStatus) {
    if (!standaloneIssue?.parentIssueKey || !issueStatuses.includes(status)) {
      throw new Error("Cannot confirm a standalone task without a valid subtask and status.");
    }
    const { parentIssueKey: _parentIssueKey, ...standalone } = standaloneIssue;
    const updatedIssue = { ...standalone, status };
    setIssues((current) =>
      current.map((issue) =>
        issue.projectId === selectedProjectId && issue.key === updatedIssue.key
          ? updatedIssue
          : issue,
      ),
    );
    if (makeStandaloneDialog?.fromDetail) {
      setFocusStandaloneAction(false);
      setSelectedIssue(updatedIssue);
    }
    setStatusAnnouncement(`Issue ${updatedIssue.key} is now a standalone Task in ${status}.`);
    setMakeStandaloneDialog(null);
  }

  function startMakeSubtask(issueKey: string, parentKey?: string, fromDetail = false) {
    const source = projectIssues.find((issue) => issue.key === issueKey);
    const parent = parentKey
      ? projectIssues.find((issue) => issue.key === parentKey)
      : undefined;
    if (
      !source ||
      (parentKey && (!parent || parent.parentIssueKey || parent.key === source.key || parent.key === source.parentIssueKey))
    ) {
      throw new Error("A subtask must have a different top-level parent in this project.");
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

  function confirmMakeSubtask(parentKey: string) {
    const source = makeSubtaskIssue;
    const parent = projectIssues.find((issue) => issue.key === parentKey);
    if (
      !source ||
      !parent ||
      parent.parentIssueKey ||
      source.key === parent.key ||
      source.parentIssueKey === parent.key
    ) {
      throw new Error("A subtask must have a different top-level parent in this project.");
    }
    const updatedSource: Issue = { ...source, issueType: "Task", parentIssueKey: parent.key };
    setIssues((current) =>
      current.map((issue) => {
        if (issue.projectId !== selectedProjectId) return issue;
        if (issue.key === source.key) return updatedSource;
        if (issue.key === parent.key) return { ...issue, issueType: "Story" };
        if (issue.parentIssueKey === source.key) {
          const { parentIssueKey: _parentIssueKey, ...standaloneIssue } = issue;
          return standaloneIssue;
        }
        return issue;
      }),
    );
    if (makeSubtaskDialog?.fromDetail) openIssue(updatedSource);
    setStatusAnnouncement(`Issue ${source.key} is now a subtask of ${parent.key}.`);
    setMakeSubtaskDialog(null);
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
    <div className="app-shell">
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
              <h1>{selectedProject.name}</h1>
              <button
                className="icon-button edit-project-button"
                type="button"
                aria-label="Edit project"
                title="Edit project"
                onClick={() =>
                  setProjectDialog({ mode: "edit", project: selectedProject })
                }
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
                onMakeSubtask={(issueKey, parentKey) => startMakeSubtask(issueKey, parentKey)}
              />
            ) : (
              <IssueList
                issues={visibleIssues}
                hasSubtasks={projectIssues.some((issue) => Boolean(issue.parentIssueKey))}
                onOpenIssue={openIssue}
              />
            )}
            <div className="board-footer" aria-live="polite" aria-atomic="true">
              <span>
                Showing <strong>{visibleIssues.length}</strong> of{" "}
                {totalVisibleIssues} {view === "board" && filterKey ? "top-level issues" : "issues"}
                {view === "board" && filterKey && (
                  <> · {matchingSubtaskCount} matching {matchingSubtaskCount === 1 ? "subtask" : "subtasks"}</>
                )}
              </span>
            </div>
          </section>
        </div>
      </main>

      {selectedIssue && !editingIssue && !makeSubtaskDialog && !makeStandaloneDialog && (
        <IssueDetailPanel
          key={selectedIssue.key}
          issue={selectedIssue}
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
          fallbackFocusRef={searchInput}
          canMakeSubtask={
            projectIssues.some((issue) =>
              !issue.parentIssueKey &&
              issue.key !== selectedIssue.key &&
              issue.key !== selectedIssue.parentIssueKey,
            )
          }
          onClose={() => setSelectedIssue(null)}
          onUpdate={updateIssue}
          onEdit={setEditingIssue}
          onMakeSubtask={(issue) => startMakeSubtask(issue.key, undefined, true)}
          onMakeStandalone={(issue) => startMakeStandalone(issue.key, issue.status, true)}
          onCreateSubtask={openSubtaskDialog}
          onOpenIssue={openIssue}
        />
      )}

      {makeSubtaskDialog && makeSubtaskIssue && (
        <MakeSubtaskDialog
          issue={makeSubtaskIssue}
          candidates={projectIssues.filter(
            (issue) => !issue.parentIssueKey &&
              issue.key !== makeSubtaskIssue.key &&
              issue.key !== makeSubtaskIssue.parentIssueKey,
          )}
          initialParentKey={makeSubtaskDialog.parentKey}
          hasSubtasks={projectIssues.some((issue) => issue.parentIssueKey === makeSubtaskIssue.key)}
          onConfirm={confirmMakeSubtask}
          onClose={closeMakeSubtask}
        />
      )}

      {makeStandaloneDialog && standaloneIssue && (
        <MakeStandaloneDialog
          issue={standaloneIssue}
          initialStatus={makeStandaloneDialog.initialStatus}
          fallbackFocusRef={searchInput}
          onConfirm={confirmMakeStandalone}
          onClose={closeMakeStandalone}
        />
      )}

      {isCreateIssueOpen && (
        <IssueDialog
          project={selectedProject}
          onSave={createIssue}
          onClose={() => setIsCreateIssueOpen(false)}
        />
      )}

      {subtaskParentIssue && (
        <IssueDialog
          project={selectedProject}
          parentIssue={subtaskParentIssue}
          onSave={(draft) => createSubtask(subtaskParentIssue, draft)}
          onClose={closeSubtaskDialog}
        />
      )}

      {editingIssue && (
        <IssueDialog
          project={selectedProject}
          issue={editingIssue}
          hasSubtasks={projectIssues.some(
            (issue) => issue.parentIssueKey === editingIssue.key,
          )}
          onSave={(draft) => {
            updateIssue({ ...editingIssue, ...draft });
            closeIssueEditor();
          }}
          onClose={closeIssueEditor}
        />
      )}

      {projectDialog && (
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
          onSave={saveProject}
          onClose={() => setProjectDialog(null)}
        />
      )}
    </div>
  );
}

export default App;
