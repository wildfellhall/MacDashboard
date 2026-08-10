// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotesApp } from "./NotesApp";
import type { Note } from "../types";

afterEach(cleanup);

const note: Note = {
  id: "ideas",
  title: "Idea Map",
  folder: "Ideas",
  content: "<h1>Idea Map</h1><p>Draw the relationship.</p>",
  updatedAt: "2026-07-29T12:00:00.000Z",
};

const preferencesNote: Note = {
  id: "preferences",
  title: "Preferences",
  folder: "Personal",
  content: "<h1>Preferences</h1><p>Interests: design</p>",
  updatedAt: "2026-07-29T11:00:00.000Z",
};

function EditableNotesHarness() {
  const [notes, setNotes] = useState([note]);
  return (
    <NotesApp
      notes={notes}
      selectedNoteId={note.id}
      onSelectNote={vi.fn()}
      onChangeNotes={setNotes}
      onAskForHelp={vi.fn()}
      recommendationSignalCounts={{ ideas: 3 }}
    />
  );
}

function DeletableNotesHarness() {
  const [notes, setNotes] = useState([preferencesNote, note]);
  const [selectedNoteId, setSelectedNoteId] = useState(note.id);
  return (
    <NotesApp
      notes={notes}
      selectedNoteId={selectedNoteId}
      onSelectNote={setSelectedNoteId}
      onChangeNotes={setNotes}
      onAskForHelp={vi.fn()}
    />
  );
}

const placeCaretAtEnd = (element: HTMLElement) => {
  const range = document.createRange();
  const textNode = element.lastChild ?? element;
  range.setStart(textNode, textNode.textContent?.length ?? 0);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe("Notes rich-text editor", () => {
  it("preserves the caret while several characters update controlled note state", () => {
    render(<EditableNotesHarness />);
    const editor = screen.getByLabelText("Edit Idea Map");
    editor.focus();

    for (const content of [
      "<h1>Idea Map</h1><p>A</p>",
      "<h1>Idea Map</h1><p>AB</p>",
      "<h1>Idea Map</h1><p>ABC</p>",
    ]) {
      editor.innerHTML = content;
      placeCaretAtEnd(editor.querySelector("p") as HTMLElement);
      fireEvent.input(editor);

      expect(editor.innerHTML).toBe(content);
      expect(window.getSelection()?.isCollapsed).toBe(true);
      expect(window.getSelection()?.anchorOffset).toBe(
        editor.querySelector("p")?.textContent?.length,
      );
    }

    expect(screen.getByText("ABC")).toBeTruthy();
  });

  it("uses inline highlight semantics and keeps toolbar clicks from taking selection", () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    render(<EditableNotesHarness />);

    const highlight = screen.getByRole("button", { name: "Highlight" });
    expect(fireEvent.mouseDown(highlight)).toBe(false);
    fireEvent.click(highlight);

    expect(execCommand).toHaveBeenCalledWith(
      "hiliteColor",
      false,
      "#ffe477",
    );
  });

  it("shows when the selected note is shaping recommendations", () => {
    render(<EditableNotesHarness />);

    expect(screen.getByText(/3 recommendation signals/)).toBeTruthy();
  });

  it("requires confirmation to delete a note and protects Preferences", () => {
    render(<DeletableNotesHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Idea Map" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete Idea Map?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep Note" }));
    expect(screen.getByLabelText("Edit Idea Map")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete Idea Map" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Note" }));

    expect(screen.queryByLabelText("Edit Idea Map")).toBeNull();
    expect(screen.getByLabelText("Edit Preferences")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Preferences note cannot be deleted",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("Notes sketch canvas", () => {
  it("creates a persistent vector stroke from pointer input", () => {
    const onChangeNotes = vi.fn();
    render(
      <NotesApp
        notes={[note]}
        selectedNoteId={note.id}
        onSelectNote={vi.fn()}
        onChangeNotes={onChangeNotes}
        onAskForHelp={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Show sketch tools"));
    const canvas = screen.getByRole("img", {
      name: "Editable sketch with 0 strokes",
    });
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        width: 500,
        height: 260,
        right: 500,
        bottom: 260,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    Object.defineProperty(canvas, "setPointerCapture", {
      value: vi.fn(),
    });

    fireEvent.pointerDown(canvas, {
      pointerId: 4,
      clientX: 25,
      clientY: 30,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 4,
      clientX: 90,
      clientY: 70,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 4,
      clientX: 90,
      clientY: 70,
    });

    expect(onChangeNotes).toHaveBeenCalledWith([
      expect.objectContaining({
        id: note.id,
        sketch: {
          version: 1,
          strokes: [
            expect.objectContaining({
              color: "#202124",
              width: 4,
              points: expect.any(Array),
            }),
          ],
        },
      }),
    ]);
  });

  it("requires confirmation before clearing every stroke", () => {
    const onChangeNotes = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <NotesApp
        notes={[
          {
            ...note,
            sketch: {
              version: 1,
              strokes: [
                {
                  id: "one",
                  color: "#202124",
                  width: 4,
                  points: [{ x: 20, y: 20 }],
                },
              ],
            },
          },
        ]}
        selectedNoteId={note.id}
        onSelectNote={vi.fn()}
        onChangeNotes={onChangeNotes}
        onAskForHelp={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Clear sketch"));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onChangeNotes).not.toHaveBeenCalled();
  });
});
