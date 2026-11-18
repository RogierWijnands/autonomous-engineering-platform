import { createHmac, randomUUID } from "node:crypto";
import { InputError } from "../database/store.ts";
import { isRecord } from "../../src/utils/issueValidation.ts";

const defaultWebhookUrl = "http://127.0.0.1:5062/api/webhooks/jira";
const deliveryError =
  "AEP did not confirm receipt. Execution may have started; check AEP before trying again.";

export function createExecuteJiraIssueWebhook(
  url = defaultWebhookUrl,
  secret = process.env.AEP_WEBHOOK_SECRET,
) {
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

  return async (issueKey: string, repository: string) => {
    if (!secret || Buffer.byteLength(secret, "utf8") < 32)
      throw new InputError(
        "Execution webhook authentication is not configured.",
        503,
      );
    const body = JSON.stringify({
      event: "issue.execution_requested",
      eventId: randomUUID(),
      issueKey,
      repository,
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    try {
      const response = await fetch(destination, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Aep-Signature": `sha256=${signature}`,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 409)
          throw new InputError(
            "AEP rejected the request. Check the GitHub repository mapping and AEP logs.",
            409,
          );
        console.error(`Execution webhook returned HTTP ${response.status}.`);
        throw new InputError(deliveryError, 502);
      }
      if (!response.body) throw new InputError(deliveryError, 502);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          await reader.cancel();
          throw new InputError(deliveryError, 502);
        }
        chunks.push(value);
      }
      const result: unknown = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      );
      if (!isRecord(result) || typeof result.alreadyQueued !== "boolean")
        throw new InputError(deliveryError, 502);
      return { alreadyQueued: result.alreadyQueued };
    } catch (error) {
      if (error instanceof InputError) throw error;
      if (
        !(error instanceof TypeError) &&
        !(error instanceof DOMException) &&
        !(error instanceof SyntaxError)
      )
        throw error;
      console.error("Execution webhook delivery could not be confirmed.");
      throw new InputError(deliveryError, 502);
    }
  };
}
