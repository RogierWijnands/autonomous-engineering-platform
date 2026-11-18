import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Project, ProjectDraft } from "../../types";
import { projectIssuePrefix } from "../../utils/projectIssuePrefix";
import { isGitHubRepository } from "../../utils/githubRepository";
import { useDialogFocus } from "../common/useDialogFocus";

interface ProjectDialogProps {
  project?: Project;
  projects: Project[];
  requestError?: string;
  focusDeleteAction?: boolean;
  initialDraft?: ProjectDraft;
  onDelete?: (draft: ProjectDraft) => void;
  onSave: (draft: ProjectDraft) => void;
  onClose: () => void;
}

export function ProjectDialog({
  project,
  projects,
  requestError,
  focusDeleteAction = false,
  initialDraft,
  onDelete,
  onSave,
  onClose,
}: ProjectDialogProps) {
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose);
  const [name, setName] = useState(initialDraft?.name ?? project?.name ?? "");
  const [repository, setRepository] = useState(
    initialDraft?.repository ?? project?.repository ?? "",
  );
  const [error, setError] = useState("");
  const [repositoryError, setRepositoryError] = useState(false);
  const title = project ? "Edit project" : "Create project";

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const prefix = projectIssuePrefix(normalizedName);

    if (!normalizedName) {
      setError("Enter a project name.");
      return;
    }

    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)) {
      setError(
        "Use a project name that produces a 2-10 character prefix starting with a letter.",
      );
      return;
    }

    const duplicateName = projects.some(
      (candidate) =>
        candidate.id !== project?.id &&
        candidate.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (duplicateName) {
      setError("A project with that name already exists.");
      return;
    }

    const duplicatePrefix = projects.some(
      (candidate) =>
        candidate.id !== project?.id &&
        projectIssuePrefix(candidate.name) === prefix,
    );
    if (duplicatePrefix) {
      setError(
        `Another project already uses the issue-ID prefix ${prefix}. Choose a different name.`,
      );
      return;
    }

    const normalizedRepository = repository.trim();
    if (!isGitHubRepository(normalizedRepository)) {
      setRepositoryError(true);
      event.currentTarget
        .querySelector<HTMLInputElement>('[name="repository"]')
        ?.focus();
      return;
    }

    onSave({ name: normalizedName, repository: normalizedRepository });
  }

  return (
    <div
      className="overlay modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="create-modal project-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onSubmit={submitProject}
      >
        {requestError && (
          <p className="form-error" role="alert">
            {requestError}
          </p>
        )}
        <div className="modal-heading">
          <h2 id="project-dialog-title">{title}</h2>
          <button
            type="button"
            className="icon-button close-button"
            aria-label="Close project form"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label className="form-field">
          <span>
            Project name <i aria-hidden="true">*</i>
          </span>
          <input
            data-dialog-initial-focus={!focusDeleteAction || undefined}
            required
            maxLength={80}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
          <small className="project-prefix-hint">
            Issue IDs use a prefix derived from the project name.
          </small>
        </label>
        <label className="form-field">
          <span id="project-repository-label">
            Default GitHub repository <i aria-hidden="true">*</i>
          </span>
          <input
            name="repository"
            aria-required="true"
            value={repository}
            maxLength={140}
            placeholder="owner/repository"
            aria-labelledby="project-repository-label"
            aria-invalid={repositoryError || undefined}
            aria-describedby="project-repository-hint"
            onChange={(event) => {
              setRepository(event.target.value);
              setRepositoryError(false);
            }}
          />
          <small id="project-repository-hint">
            {repositoryError
              ? "Enter a valid owner/repository, without a URL or .git suffix."
              : "Required. Used unless an issue specifies its own repository."}
          </small>
          {repositoryError && (
            <span className="form-error" role="alert">
              A valid default GitHub repository is required.
            </span>
          )}
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <div className="modal-buttons">
            {project && onDelete && (
              <button
                type="button"
                className="secondary-button"
                data-dialog-initial-focus={focusDeleteAction || undefined}
                onClick={() => onDelete({ name, repository })}
              >
                Delete project
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              {project ? "Save changes" : "Create project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
