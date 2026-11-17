import { CirclePlus } from "lucide-react";
import type { Project } from "../../types";
import { LogoMark } from "../common/LogoMark";

interface ProjectSidebarProps {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
}: ProjectSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="Jira Simulator">
        <LogoMark />
        <span className="brand-name">Jira Simulator</span>
      </div>

      <div className="sidebar-section-label project-label">
        <span>PROJECTS</span>
        <button
          className="icon-button sidebar-add"
          type="button"
          aria-label="Create project"
          onClick={onCreateProject}
        >
          <CirclePlus size={16} />
        </button>
      </div>
      <nav className="project-list" aria-label="Projects">
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          return (
            <button
              className={`project-link${isSelected ? " active" : ""}`}
              key={project.id}
              type="button"
              title={project.name}
              aria-label={`Select ${project.name} project`}
              aria-current={isSelected ? "page" : undefined}
              onClick={() => onSelectProject(project.id)}
            >
              <span className="project-icon">{project.name.charAt(0).toUpperCase()}</span>
              <span>{project.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
