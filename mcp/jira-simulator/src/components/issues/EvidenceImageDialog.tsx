import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "../common/useDialogFocus";
import { isEvidenceDocument, MAX_IMAGE_BYTES } from "../../utils/evidence";

interface EvidenceImageDialogProps {
  triggerRef: RefObject<HTMLButtonElement>;
  onInsert: (src: string, alt: string) => string | null;
  onClose: () => void;
}

export function EvidenceImageDialog({
  triggerRef,
  onInsert,
  onClose,
}: EvidenceImageDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"file" | null>(null);
  const [inserting, setInserting] = useState(false);
  const readerRef = useRef<FileReader | null>(null);

  // The issue dialog must be unavailable while its nested dialog is open.
  useLayoutEffect(() => {
    const parent = triggerRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!parent) return;
    const wasInert = parent.inert;
    parent.inert = true;
    return () => {
      parent.inert = wasInert;
    };
  }, [triggerRef]);

  function abortRead() {
    const reader = readerRef.current;
    if (!reader) return;
    reader.onload = null;
    reader.onerror = null;
    reader.onloadend = null;
    if (reader.readyState === FileReader.LOADING) reader.abort();
    readerRef.current = null;
  }

  function close() {
    abortRead();
    onClose();
  }

  const dialogRef = useDialogFocus<HTMLFormElement>(close, triggerRef);
  useEffect(() => () => abortRead(), []);

  function showError(message: string, field: "file" | null = null) {
    setError(message);
    setErrorField(field);
  }

  function insertImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inserting || readerRef.current) return;
    if (!file) {
      showError("Choose an image first.", "file");
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > MAX_IMAGE_BYTES
    ) {
      showError("Choose a PNG, JPEG or WebP image up to 512 KB.", "file");
      return;
    }

    const reader = new FileReader();
    readerRef.current = reader;
    showError("");
    setInserting(true);
    reader.onerror = () => showError("Could not read the image.", "file");
    reader.onloadend = () => {
      readerRef.current = null;
      setInserting(false);
    };
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        showError("Could not read the image.", "file");
        return;
      }
      const description = alt.trim();
      const image = {
        type: "image",
        attrs: { src: reader.result, alt: description },
      };
      if (!isEvidenceDocument({ type: "doc", content: [image] })) {
        showError(
          "The image must be a static PNG, JPEG or WebP and at most 4096 by 4096 pixels.",
          "file",
        );
        return;
      }
      const insertError = onInsert(reader.result, description);
      if (insertError) {
        showError(insertError);
        return;
      }
      close();
    };
    reader.readAsDataURL(file);
  }

  return createPortal(
    <div
      className="overlay modal-overlay image-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        ref={dialogRef}
        className="create-modal image-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-dialog-title"
        aria-describedby="image-dialog-help"
        noValidate
        onSubmit={insertImage}
      >
        <div className="modal-heading">
          <h2 id="image-dialog-title">Insert Image</h2>
          <button
            type="button"
            className="icon-button close-button"
            aria-label="Close insert image dialog"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <p id="image-dialog-help">
          Choose a static PNG, JPEG or WebP image up to 512 KB and 4096 by 4096
          pixels. A description helps people using screen readers.
        </p>
        <label className="form-field">
          <span>Image file</span>
          <input
            data-dialog-initial-focus
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-invalid={errorField === "file" || undefined}
            aria-describedby={
              errorField === "file" ? "image-dialog-error" : undefined
            }
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              showError("");
            }}
          />
        </label>
        <label className="form-field">
          <span>Image description (optional)</span>
          <input
            value={alt}
            maxLength={200}
            onChange={(event) => {
              setAlt(event.target.value);
              showError("");
            }}
          />
        </label>
        {error && (
          <p id="image-dialog-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <div className="modal-buttons">
            <button type="button" className="secondary-button" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={inserting}
            >
              Insert Image
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
