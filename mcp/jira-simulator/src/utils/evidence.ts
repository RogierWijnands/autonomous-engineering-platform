import { imageSize } from "image-size";

export interface EvidenceNode {
  type: string;
  text?: string;
  marks?: { type: "bold" | "italic" }[];
  attrs?: {
    src: string;
    alt?: string | null;
    title?: null;
    width?: null;
    height?: null;
  };
  content?: EvidenceNode[];
}

export interface EvidenceDocument {
  type: "doc";
  content: EvidenceNode[];
}

export const MAX_IMAGE_BYTES = 512_000;
export const MAX_EVIDENCE_BYTES = 2_500_000;
export const MAX_EVIDENCE_IMAGES = 3;

const allowedParents = new Map<string, string[]>([
  ["doc", [""]],
  ["paragraph", ["doc", "listItem"]],
  ["bulletList", ["doc", "listItem"]],
  ["listItem", ["bulletList"]],
]);

export function emptyEvidence(): EvidenceDocument {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isStaticImage(data: Uint8Array, type: string): boolean {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (type === "jpeg") {
    return (
      data.length >= 2 &&
      data[data.length - 2] === 0xff &&
      data[data.length - 1] === 0xd9
    );
  }

  let offset = type === "png" ? 8 : 12;
  while (offset + (type === "png" ? 12 : 8) <= data.length) {
    const length =
      type === "png"
        ? view.getUint32(offset)
        : view.getUint32(offset + 4, true);
    const nameOffset = type === "png" ? offset + 4 : offset;
    const name = String.fromCharCode(...data.slice(nameOffset, nameOffset + 4));
    const next =
      offset +
      (type === "png" ? 12 : 8) +
      length +
      (type === "webp" ? length % 2 : 0);
    if (
      next > data.length ||
      name === "acTL" ||
      name === "ANIM" ||
      name === "ANMF"
    )
      return false;
    if (type === "webp" && name === "VP8X" && (data[offset + 8] & 2) !== 0)
      return false;
    if (type === "png" && name === "IEND") return next === data.length;
    offset = next;
  }
  return type === "webp" && offset === data.length;
}

function validImageSource(src: unknown): boolean {
  if (typeof src !== "string") return false;

  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if (!match || match[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    return false;
  }

  try {
    const bytes = atob(match[2]);
    if (bytes.length > MAX_IMAGE_BYTES || btoa(bytes) !== match[2])
      return false;

    const data = Uint8Array.from(bytes, (character) => character.charCodeAt(0));
    const dimensions = imageSize(data);
    const expectedType = match[1] === "jpeg" ? "jpg" : match[1];
    return (
      dimensions.type === expectedType &&
      isStaticImage(data, match[1]) &&
      dimensions.width !== undefined &&
      dimensions.height !== undefined &&
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      dimensions.width <= 4096 &&
      dimensions.height <= 4096
    );
  } catch {
    return false;
  }
}

export function isEvidenceDocument(value: unknown): value is EvidenceDocument {
  let nodes = 0;
  let textLength = 0;
  let images = 0;

  function checkNode(node: unknown, parent: string, depth: number): boolean {
    if (!isRecord(node) || typeof node.type !== "string" || depth > 8) {
      return false;
    }

    nodes++;
    if (nodes > 2_000) return false;

    if (node.type === "text") {
      if (
        parent !== "paragraph" ||
        !hasOnly(node, ["type", "text", "marks"]) ||
        typeof node.text !== "string" ||
        !node.text ||
        (node.marks !== undefined &&
          (!Array.isArray(node.marks) ||
            !node.marks.every(
              (mark: unknown) =>
                isRecord(mark) &&
                hasOnly(mark, ["type"]) &&
                (mark.type === "bold" || mark.type === "italic"),
            )))
      ) {
        return false;
      }

      textLength += node.text.length;
      return textLength <= 20_000;
    }

    if (node.type === "hardBreak") {
      return parent === "paragraph" && hasOnly(node, ["type"]);
    }

    if (node.type === "image") {
      images++;
      return (
        parent === "doc" &&
        images <= MAX_EVIDENCE_IMAGES &&
        hasOnly(node, ["type", "attrs"]) &&
        isRecord(node.attrs) &&
        hasOnly(node.attrs, ["src", "alt", "title", "width", "height"]) &&
        (node.attrs.alt === undefined ||
          node.attrs.alt === null ||
          (typeof node.attrs.alt === "string" &&
            node.attrs.alt.length <= 200)) &&
        (node.attrs.title === undefined || node.attrs.title === null) &&
        (node.attrs.width === undefined || node.attrs.width === null) &&
        (node.attrs.height === undefined || node.attrs.height === null) &&
        validImageSource(node.attrs.src)
      );
    }

    if (
      !allowedParents.get(node.type)?.includes(parent) ||
      !hasOnly(node, ["type", "content"]) ||
      (node.content !== undefined && !Array.isArray(node.content))
    ) {
      return false;
    }

    if (
      node.type === "listItem" &&
      (!Array.isArray(node.content) ||
        !isRecord(node.content[0]) ||
        node.content[0].type !== "paragraph")
    ) {
      return false;
    }

    if (
      (node.type === "doc" ||
        node.type === "bulletList" ||
        node.type === "listItem") &&
      (!Array.isArray(node.content) || node.content.length === 0)
    ) {
      return false;
    }

    return (
      node.content === undefined ||
      (Array.isArray(node.content) &&
        node.content.every((child: unknown) =>
          checkNode(child, node.type as string, depth + 1),
        ))
    );
  }

  return (
    checkNode(value, "", 0) &&
    JSON.stringify(value).length <= MAX_EVIDENCE_BYTES
  );
}
