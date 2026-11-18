import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EvidenceSection } from "./EvidenceSection";

describe("EvidenceSection", () => {
  it.each([
    {
      type: "image",
      attrs: { src: "http://127.0.0.1:9/image", alt: "Remote" },
    },
    { type: "image", attrs: { src: "data:image/svg+xml;base64,PHN2Zz4=" } },
    { type: "paragraph", content: [{ type: "script", text: "alert(1)" }] },
  ])(
    "rejects unsafe loaded evidence before rendering or editing it",
    (node) => {
      const { container } = render(
        <EvidenceSection
          evidence={{ type: "doc", content: [node] }}
          onSave={vi.fn()}
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Evidence could not be displayed",
      );
      expect(container.querySelector("img, script")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Edit evidence" }),
      ).toBeNull();
    },
  );

  it("renders evidence text as text rather than markup", () => {
    const text = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <EvidenceSection
        evidence={{
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        }}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(text)).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });

  it("removes the editor if updated evidence is unsafe", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(<EvidenceSection onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    const editor = screen.getByRole("textbox", { name: "Evidence editor" });
    await waitFor(() => expect(editor).toHaveFocus());
    rerender(
      <EvidenceSection
        evidence={{
          type: "doc",
          content: [
            { type: "image", attrs: { src: "http://127.0.0.1:9/image" } },
          ],
        }}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "Evidence editor" }),
    ).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses Add for missing evidence and restores focus after cancel", async () => {
    const user = userEvent.setup();
    render(<EvidenceSection onSave={vi.fn()} />);
    const add = screen.getByRole("button", { name: "Add evidence" });
    expect(screen.getByText("No evidence added.")).toBeVisible();
    await user.click(add);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Add evidence" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Edit evidence" })).toBeNull();
  });

  it.each([undefined, null, ""])(
    "loads and saves an existing image with description %s",
    async (alt) => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(true);
      render(
        <EvidenceSection
          evidence={{
            type: "doc",
            content: [
              {
                type: "image",
                attrs: {
                  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=",
                  ...(alt === undefined ? {} : { alt }),
                },
              },
            ],
          }}
          onSave={onSave}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Edit evidence" }));
      expect(
        screen.getByRole("img", { name: "Evidence image" }),
      ).toHaveAttribute("tabindex", "0");
      await user.click(screen.getByRole("button", { name: "Save evidence" }));
      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    },
  );

  it.each(["Delete", "Backspace"])(
    "removes only the focused image with %s and keeps the editor usable",
    async (key) => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(true);
      const src =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=";
      const keptImage = { type: "image" as const, attrs: { src, alt: "Keep" } };
      render(
        <EvidenceSection
          evidence={{
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Text" }] },
              keptImage,
              { type: "image", attrs: { src, alt: "Remove" } },
            ],
          }}
          onSave={onSave}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Edit evidence" }));
      const editor = screen.getByRole("textbox", { name: "Evidence editor" });
      await waitFor(() => expect(editor).toHaveFocus());
      const image = within(editor).getByRole("img", { name: "Remove" });
      expect(image).toHaveAttribute("tabindex", "0");
      expect(image).toHaveAccessibleDescription(
        "Delete or Backspace removes the selected image.",
      );
      image.focus();
      await user.keyboard(`{${key}}`);

      expect(within(editor).queryByRole("img", { name: "Remove" })).toBeNull();
      expect(within(editor).getByRole("img", { name: "Keep" })).toBeVisible();
      expect(editor).toHaveTextContent("Text");
      expect(editor).toHaveFocus();
      await user.click(screen.getByRole("button", { name: "Save evidence" }));
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "image",
                attrs: expect.objectContaining(keptImage.attrs),
              }),
            ]),
          }),
        ),
      );
    },
  );

  it("saves formatted evidence and restores focus", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <EvidenceSection
        evidence={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Verification passed",
                  marks: [{ type: "bold" }],
                },
              ],
            },
          ],
        }}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    expect(
      screen.getByRole("textbox", { name: "Evidence editor" }),
    ).toHaveTextContent("Verification passed");
    await user.click(screen.getByRole("button", { name: "Save evidence" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "doc",
          content: [
            expect.objectContaining({
              content: [
                expect.objectContaining({
                  text: "Verification passed",
                  marks: [{ type: "bold" }],
                }),
              ],
            }),
          ],
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit evidence" }),
      ).toHaveFocus(),
    );
  });

  it("inserts and saves an image without a description", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EvidenceSection onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    await user.click(screen.getByRole("button", { name: "Insert Image" }));
    const dialog = screen.getByRole("dialog", { name: "Insert Image" });
    await user.upload(
      within(dialog).getByLabelText("Image file"),
      new File(
        [
          Uint8Array.from(
            atob(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=",
            ),
            (character) => character.charCodeAt(0),
          ),
        ],
        "evidence.png",
        { type: "image/png" },
      ),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Insert Image" }),
    );
    const image = await screen.findByRole("img", { name: "Evidence image" });
    expect(image).toHaveAttribute("alt", "");
    await user.click(screen.getByRole("button", { name: "Save evidence" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "image",
              attrs: expect.objectContaining({ alt: "" }),
            }),
          ]),
        }),
      ),
    );
  });

  it("cancels the image dialog and keeps the editor open", async () => {
    const user = userEvent.setup();
    render(<EvidenceSection onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    const editor = screen.getByRole("textbox", { name: "Evidence editor" });
    await waitFor(() => expect(editor).toHaveFocus());
    const trigger = screen.getByRole("button", { name: "Insert Image" });
    await user.click(trigger);
    expect(screen.getByLabelText("Image file")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Insert Image" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(editor).toBeInTheDocument();
  });
});
