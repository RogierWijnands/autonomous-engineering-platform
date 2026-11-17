import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Project, ProjectDraft } from "../../types";
import { projectIssuePrefix } from "../../utils/projectIssuePrefix";
import { useDialogFocus } from "../common/useDialogFocus";

interface ProjectDialogProps {
  project?: Project;
  projects: Project[];
  onSave: (draft: ProjectDraft) => void;
  onClose: () => void;
}

export function ProjectDialog({
  project,
  projects,
  onSave,
  onClose,
}: ProjectDialogProps) {
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose);
  const [name, setName] = useState(project?.name ?? "");
  const [error, setError] = useState("");
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

    onSave({ name: normalizedName });
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
          <span>Project name <i aria-hidden="true">*</i></span>
          <input
            data-dialog-initial-focus
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-footer">
          <div className="modal-buttons">
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
