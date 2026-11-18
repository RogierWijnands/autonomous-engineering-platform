import { useLayoutEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function useDialogFocus<T extends HTMLElement>(
  onClose: () => void,
  fallbackFocusRef?: RefObject<HTMLElement>,
): RefObject<T> {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const activeDialog = dialogRef.current;

    if (!activeDialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    const initialFocus =
      activeDialog.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      activeDialog.querySelector<HTMLElement>(focusableSelector);

    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (!activeDialog) return;

      if (event.key === "Escape") {
        if (
          event.target instanceof HTMLSelectElement &&
          typeof CSS !== "undefined" &&
          typeof CSS.supports === "function" &&
          CSS.supports("selector(select:open)") &&
          event.target.matches(":open")
        ) {
          return;
        }

        event.preventDefault();
        onCloseRef.current();

        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        activeDialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");

      if (focusableElements.length === 0) {
        event.preventDefault();
        activeDialog.focus();

        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        !(activeElement instanceof HTMLElement) ||
        !focusableElements.includes(activeElement)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();

        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      const returnFocus = previouslyFocused?.isConnected
        ? previouslyFocused
        : fallbackFocusRef?.current;

      returnFocus?.focus();
    };
  }, []);

  return dialogRef;
}
