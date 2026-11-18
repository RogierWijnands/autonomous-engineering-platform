import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "../common/useDialogFocus";
import { ApiRequestError, request } from "../../utils/api";

interface ExecuteIssueDialogProps {
  issueKey: string;
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
}

const uncertainDelivery =
  "Could not confirm whether AEP received the request. Execution may have started; check AEP before trying again.";

export function ExecuteIssueDialog({
  issueKey,
  triggerRef,
  onClose,
}: ExecuteIssueDialogProps) {
  const [sending, setSending] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [alreadyQueued, setAlreadyQueued] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const parent = triggerRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!parent) return;
    const wasInert = parent.inert;
    parent.inert = true;
    return () => {
      parent.inert = wasInert;
    };
  }, [triggerRef]);

  function close() {
    if (!pending.current) onClose();
  }

  const dialogRef = useDialogFocus<HTMLDivElement>(close, triggerRef);

  useLayoutEffect(() => {
    if (sending) statusRef.current?.focus();
    else if (error) errorRef.current?.focus();
    else if (delivered) doneRef.current?.focus();
  }, [sending, error, delivered]);

  async function execute() {
    if (pending.current || delivered) return;
    pending.current = true;
    setSending(true);
    setError("");
    try {
      const result = await request<{
        delivered?: unknown;
        alreadyQueued?: unknown;
      }>("issues/execute", { key: issueKey }, uncertainDelivery);
      if (
        !result ||
        result.delivered !== true ||
        typeof result.alreadyQueued !== "boolean"
      )
        throw new Error(uncertainDelivery);
      setAlreadyQueued(result.alreadyQueued);
      setDelivered(true);
    } catch (cause) {
      const message =
        cause instanceof Error && !(cause instanceof SyntaxError)
          ? cause.message
          : uncertainDelivery;
      setError(
        (cause instanceof ApiRequestError && cause.status === 409) ||
          message.includes("Execution may have started")
          ? message
          : `${message} ${uncertainDelivery}`,
      );
    } finally {
      pending.current = false;
      setSending(false);
    }
  }

  return createPortal(
    <div
      className="overlay modal-overlay image-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="create-modal execute-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="execute-title"
        aria-describedby="execute-description"
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2 id="execute-title">Execute issue?</h2>
          <button
            type="button"
            className="icon-button close-button"
            aria-label="Close execution confirmation"
            disabled={sending}
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <div id="execute-description">
          <p>
            Send <strong>{issueKey}</strong> to AEP to start an automated code
            workflow.
          </p>
          <p>
            AEP will keep at most one queued or active execution for this issue.
            After an execution completes or fails, a new request can start one.
          </p>
        </div>
        {error && (
          <p ref={errorRef} tabIndex={-1} className="form-error" role="alert">
            {error}
          </p>
        )}
        {sending && (
          <p ref={statusRef} tabIndex={-1} role="status">
            Sending execution request...
          </p>
        )}
        {delivered && (
          <p role="status">
            {alreadyQueued
              ? "This issue is already queued or active in AEP. No duplicate execution was created."
              : "The webhook endpoint accepted the request. This does not confirm that execution has started."}
          </p>
        )}
        <div className="modal-footer">
          <div className="modal-buttons">
            <button
              type="button"
              ref={doneRef}
              className="secondary-button"
              data-dialog-initial-focus
              disabled={sending}
              onClick={close}
            >
              {delivered ? "Done" : "Cancel"}
            </button>
            {!delivered && (
              <button
                type="button"
                className="primary-button"
                disabled={sending}
                onClick={() => void execute()}
              >
                Execute issue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
