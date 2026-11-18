import { randomUUID } from "node:crypto";
import { InputError } from "../database/store.ts";

const defaultWebhookUrl = "http://127.0.0.1:5062/api/webhooks/jira";
const deliveryError =
  "AEP did not confirm receipt. Execution may have started; check AEP before trying again.";

export function createExecuteJiraIssueWebhook(url = defaultWebhookUrl) {
  let destination: URL;
  try {
    destination = new URL(url);
  } catch {
    throw new Error("Invalid execution webhook configuration.");
  }

  // The simulator is local-only; never forward issue data to arbitrary hosts.
  if (
    destination.protocol !== "http:" ||
    destination.hostname !== "127.0.0.1" ||
    destination.username ||
    destination.password ||
    destination.search ||
    destination.hash
  ) {
    throw new Error("Invalid execution webhook configuration.");
  }

  return async (issueKey: string) => {
    try {
      const response = await fetch(destination, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "issue.execution_requested",
          eventId: randomUUID(),
          issueKey,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      await response.body?.cancel();
      if (!response.ok) {
        console.error(`Execution webhook returned HTTP ${response.status}.`);
        throw new InputError(deliveryError, 502);
      }
    } catch (error) {
      if (error instanceof InputError) throw error;
      if (!(error instanceof TypeError) && !(error instanceof DOMException))
        throw error;
      console.error("Execution webhook delivery could not be confirmed.");
      throw new InputError(deliveryError, 502);
    }
  };
}
