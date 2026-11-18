import type { ImageContent } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { evidenceSchema } from "../jira/schemas.ts";

export function extractEvidenceContent(result: unknown): ImageContent[] {
  const { evidence } = z
    .object({ evidence: evidenceSchema.optional() })
    .parse(result);
  const content: ImageContent[] = [];

  // The simulator supports only embedded PNG, JPEG and WebP evidence images.
  for (const node of evidence?.content ?? []) {
    const item = z.object({ type: z.string() }).passthrough().parse(node);
    if (item.type !== "image") continue;
    const image = z
      .object({
        attrs: z.object({
          src: z.string(),
          alt: z.string().nullable().optional(),
        }),
      })
      .parse(item);
    const match =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        image.attrs.src,
      );
    if (!match)
      throw new Error("Invalid evidence image returned by the simulator.");
    content.push({ type: "image", mimeType: match[1], data: match[2] });
  }

  return content;
}
