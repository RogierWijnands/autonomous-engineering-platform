import assert from "node:assert/strict";
import { test } from "node:test";
import { isEvidenceDocument } from "../../src/utils/evidence.ts";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=";
const image = (src: string, alt = "Screenshot") => ({
  type: "image",
  attrs: { src, alt },
});
const doc = (content: unknown[]) => ({ type: "doc", content });

test("accepts bounded local images and rejects active, remote or malformed content", () => {
  assert.equal(isEvidenceDocument(doc([image(png)])), true);
  assert.equal(
    isEvidenceDocument(doc([image("https://example.com/image.png")])),
    false,
  );
  assert.equal(
    isEvidenceDocument(doc([image("data:image/svg+xml;base64,PHN2Zz4=")])),
    false,
  );
  assert.equal(
    isEvidenceDocument(doc([image("data:image/png;base64,PHN2Zz4=")])),
    false,
  );
  assert.equal(isEvidenceDocument(doc([image(png, "")])), true);
  assert.equal(
    isEvidenceDocument(doc([{ type: "image", attrs: { src: png } }])),
    true,
  );
  assert.equal(
    isEvidenceDocument(
      doc([{ type: "image", attrs: { src: png, alt: null } }]),
    ),
    true,
  );
  assert.equal(
    isEvidenceDocument(doc([{ type: "image", attrs: { src: png, alt: 1 } }])),
    false,
  );
  assert.equal(isEvidenceDocument(doc([image(png, "x".repeat(201))])), false);
  assert.equal(
    isEvidenceDocument(doc([image(png), image(png), image(png), image(png)])),
    false,
  );
  const oversized = Buffer.from(png.split(",")[1], "base64");
  oversized.writeUInt32BE(4097, 16);
  assert.equal(
    isEvidenceDocument(
      doc([image(`data:image/png;base64,${oversized.toString("base64")}`)]),
    ),
    false,
  );
  const bytes = Buffer.from(png.split(",")[1], "base64");
  const animated = Buffer.concat([
    bytes.subarray(0, 33),
    Buffer.from([0, 0, 0, 0, 97, 99, 84, 76, 0, 0, 0, 0]),
    bytes.subarray(33),
  ]);
  assert.equal(
    isEvidenceDocument(
      doc([image(`data:image/png;base64,${animated.toString("base64")}`)]),
    ),
    false,
  );
  assert.equal(isEvidenceDocument(doc([{ type: "constructor" }])), false);
  assert.equal(
    isEvidenceDocument(
      doc([
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "bulletList", content: [] }],
            },
          ],
        },
      ]),
    ),
    false,
  );
  assert.equal(
    isEvidenceDocument(
      doc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ]),
    ),
    false,
  );
});
