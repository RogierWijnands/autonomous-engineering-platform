import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, mergeAttributes, useEditor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import {
  emptyEvidence,
  isEvidenceDocument,
  type EvidenceDocument,
  type EvidenceNode,
} from "../../utils/evidence";
import { EvidenceImageDialog } from "./EvidenceImageDialog";

interface EvidenceSectionProps {
  evidence?: EvidenceDocument;
  onSave: (evidence: EvidenceDocument) => Promise<boolean>;
}

function hasEvidenceContent(nodes: EvidenceNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "image" ||
      (node.type === "text" && Boolean(node.text?.trim())) ||
      (node.content !== undefined && hasEvidenceContent(node.content)),
  );
}

function renderNodes(nodes: EvidenceNode[]): ReactNode {
  return nodes.map((node, index) => {
    const children = node.content ? renderNodes(node.content) : null;

    switch (node.type) {
      case "paragraph":
        return <p key={index}>{children}</p>;
      case "bulletList":
        return <ul key={index}>{children}</ul>;
      case "listItem":
        return <li key={index}>{children}</li>;
      case "hardBreak":
        return <br key={index} />;
      case "image":
        return node.attrs ? (
          <img
            key={index}
            src={node.attrs.src}
            alt={node.attrs.alt?.trim() || "Evidence image"}
          />
        ) : null;
      case "text": {
        let text: ReactNode = node.text;
        for (const mark of node.marks ?? []) {
          text =
            mark.type === "bold" ? <strong>{text}</strong> : <em>{text}</em>;
        }
        return <Fragment key={index}>{text}</Fragment>;
      }
      default:
        return null;
    }
  });
}

function EvidenceEditor({
  evidence,
  onSave,
  onCancel,
}: {
  evidence: EvidenceDocument;
  onSave: EvidenceSectionProps["onSave"];
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        orderedList: false,
        strike: false,
        underline: false,
      }),
      Image.extend({
        renderHTML({ HTMLAttributes }) {
          const description =
            typeof HTMLAttributes.alt === "string"
              ? HTMLAttributes.alt.trim()
              : "";
          return [
            "img",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
              role: "img",
              "aria-label": description || "Evidence image",
            }),
          ];
        },
      }).configure({
        allowBase64: true,
        HTMLAttributes: {
          tabindex: 0,
          "aria-describedby": "evidence-image-help",
        },
      }),
    ],
    content: evidence,
    enableInputRules: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Evidence editor",
        "aria-multiline": "true",
        "aria-describedby": "evidence-help",
      },
      handleDOMEvents: {
        mousedown(_view, event) {
          if (event.button !== 0 || !(event.target instanceof HTMLImageElement))
            return false;
          event.preventDefault();
          event.target.focus();
          return true;
        },
      },
      handleKeyDown(view, event) {
        if (
          !(event.target instanceof HTMLImageElement) ||
          (event.key !== "Delete" && event.key !== "Backspace")
        ) {
          return false;
        }

        const position = view.posAtDOM(event.target, 0);
        const node = view.state.doc.nodeAt(position);
        if (node?.type.name !== "image") return false;

        event.preventDefault();
        view.dispatch(view.state.tr.delete(position, position + node.nodeSize));
        view.focus();
        return true;
      },
      handlePaste(view, event) {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text) view.dispatch(view.state.tr.insertText(text));
        return true;
      },
      handleDrop() {
        return true;
      },
    },
  });

  useEffect(() => {
    editor?.commands.focus("end");
  }, [editor]);

  function insertImage(src: string, alt: string): string | null {
    if (!editor) return "Could not insert the image.";
    const image = { type: "image", attrs: { src, alt } };
    const current: unknown = editor.getJSON();
    if (
      !isEvidenceDocument(current) ||
      !isEvidenceDocument({
        ...current,
        content: [...current.content, image],
      })
    ) {
      return "Evidence exceeds its limits. Use up to three images and 20,000 characters.";
    }
    if (!editor.chain().focus("end").setImage({ src, alt }).run()) {
      return "Could not insert the image.";
    }
    setError("");
    return null;
  }

  async function save() {
    if (!editor || saving) return;
    const document: unknown = editor.getJSON();
    if (!isEvidenceDocument(document)) {
      setError(
        "Evidence exceeds its limits or contains unsupported content. Use up to three 512 KB images and 20,000 characters.",
      );
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (await onSave(document)) onCancel();
    } finally {
      setSaving(false);
    }
  }

  if (!editor) return null;

  return (
    <div
      className="evidence-editor"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !imageDialogOpen) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p id="evidence-help">
        Use bold, italic or bullets. Add up to three static PNG, JPEG or WebP
        images of 512 KB and 4096 by 4096 pixels each.
      </p>
      <p id="evidence-image-help" className="visually-hidden">
        Delete or Backspace removes the selected image.
      </p>
      <div
        className="evidence-toolbar"
        role="group"
        aria-label="Evidence formatting"
      >
        <button
          type="button"
          className="secondary-button"
          aria-pressed={editor.isActive("bold")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-pressed={editor.isActive("italic")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().toggleItalic().run()}
        >
          Italic
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-pressed={editor.isActive("bulletList")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().toggleBulletList().run()}
        >
          Bullets
        </button>
        <button
          ref={imageButtonRef}
          type="button"
          className="secondary-button"
          aria-haspopup="dialog"
          onClick={() => setImageDialogOpen(true)}
          disabled={saving}
        >
          Insert Image
        </button>
      </div>
      <EditorContent editor={editor} />
      {imageDialogOpen && (
        <EvidenceImageDialog
          triggerRef={imageButtonRef}
          onInsert={insertImage}
          onClose={() => setImageDialogOpen(false)}
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="evidence-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => void save()}
          disabled={saving}
        >
          Save evidence
        </button>
      </div>
    </div>
  );
}

export function EvidenceSection({ evidence, onSave }: EvidenceSectionProps) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const invalidEvidence =
    evidence !== undefined && !isEvidenceDocument(evidence);
  const hasEvidence =
    !invalidEvidence &&
    evidence !== undefined &&
    hasEvidenceContent(evidence.content);

  useEffect(() => {
    if (!editing && restoreFocus.current) {
      editButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [editing]);

  function closeEditor() {
    restoreFocus.current = true;
    setEditing(false);
  }

  return (
    <section className="detail-section" aria-labelledby="evidence-heading">
      <h3 id="evidence-heading">Evidence</h3>
      {invalidEvidence ? (
        <p className="form-error" role="alert">
          Evidence could not be displayed because it contains unsupported or
          unsafe content. Refresh and check the simulator data.
        </p>
      ) : editing ? (
        <EvidenceEditor
          evidence={evidence ?? emptyEvidence()}
          onSave={onSave}
          onCancel={closeEditor}
        />
      ) : (
        <>
          {hasEvidence && evidence ? (
            <div className="evidence-content">
              {renderNodes(evidence.content)}
            </div>
          ) : (
            <p className="detail-muted evidence-empty">No evidence added.</p>
          )}
          <button
            ref={editButton}
            type="button"
            className="secondary-button"
            onClick={() => setEditing(true)}
          >
            {hasEvidence ? "Edit evidence" : "Add evidence"}
          </button>
        </>
      )}
    </section>
  );
}
