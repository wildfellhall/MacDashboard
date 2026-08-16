// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { INITIAL_NOTES } from "./data";
import { DIAGNOSTIC_WORD_IDS, vocabularyWord } from "./lib/vocabulary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1440,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 900,
  });
});

describe("MacDashboard desktop", () => {
  it("opens with multiple native-style windows and a complete app dock", () => {
    render(<App />);

    expect(screen.getByLabelText("Notes window")).toBeTruthy();
    expect(screen.getByLabelText("Messages window")).toBeTruthy();
    const dock = screen.getByLabelText("Applications");
    expect(dock.children.length).toBe(8);
    expect(
      [...dock.querySelectorAll("[data-app-icon]")].map((icon) =>
        icon.getAttribute("data-app-icon"),
      ),
    ).toEqual([
      "messages",
      "notes",
      "photos",
      "books",
      "tv",
      "dictionary",
      "trash",
    ]);
    expect(
      [...dock.querySelectorAll("[data-native-icon]")].map((icon) =>
        icon.getAttribute("data-native-icon"),
      ),
    ).toEqual([
      "messages",
      "notes",
      "photos",
      "books",
      "tv",
      "dictionary",
      "trash",
    ]);
  });

  it("changes, restores, and persists the desktop background color", async () => {
    const first = render(<App />);
    const desktop = first.container.querySelector(".desktop");

    expect(desktop?.getAttribute("data-background-color")).toBe("#8faec5");
    fireEvent.click(screen.getByLabelText("MacDashboard menu"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "System Settings…" }),
    );

    expect(screen.getByRole("dialog", { name: "Wallpaper" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Use Lavender background" }),
    );
    expect(desktop?.getAttribute("data-background-color")).toBe("#aa9dca");
    expect(screen.getByText("#AA9DCA")).toBeTruthy();

    await waitFor(() =>
      expect(
        window.localStorage.getItem("macdashboard.desktop.color.v1"),
      ).toBe(JSON.stringify("#aa9dca")),
    );
    fireEvent.click(screen.getByLabelText("Close Desktop Appearance"));
    first.unmount();

    const second = render(<App />);
    expect(
      second.container
        .querySelector(".desktop")
        ?.getAttribute("data-background-color"),
    ).toBe("#aa9dca");

    fireEvent.click(screen.getByLabelText("MacDashboard menu"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "System Settings…" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore Default" }));
    expect(
      second.container
        .querySelector(".desktop")
        ?.getAttribute("data-background-color"),
    ).toBe("#8faec5");
  });

  it("runs the Dictionary diagnostic only once and syncs its words to Notes", async () => {
    const first = render(<App />);
    fireEvent.click(screen.getByLabelText("Open Dictionary"));

    expect(screen.getByLabelText("Vocabulary diagnostic")).toBeTruthy();
    for (const [index, wordId] of DIAGNOSTIC_WORD_IDS.entries()) {
      const word = vocabularyWord(wordId)!;
      fireEvent.click(screen.getByRole("button", { name: word.definition }));
      fireEvent.click(
        screen.getByRole("button", {
          name:
            index === DIAGNOSTIC_WORD_IDS.length - 1
              ? /See my starting point/i
              : /Next word/i,
        }),
      );
    }

    expect(await screen.findByText("Rare word of the day")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Vocabulary Note/i }));
    expect(
      (await screen.findAllByRole("button", { name: /Vocabulary Journal/i }))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("quotidian").length).toBeGreaterThan(0);

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem("macdashboard.dictionary.progress.v1") ??
          "null",
      );
      expect(stored?.diagnostic?.completedAt).toBeTruthy();
    });

    first.unmount();
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Dictionary"));
    expect(screen.queryByLabelText("Vocabulary diagnostic")).toBeNull();
    expect(screen.getByText("Rare word of the day")).toBeTruthy();
  });

  it("teaches an unknown Learn word before testing its application", async () => {
    window.localStorage.setItem(
      "macdashboard.dictionary.progress.v1",
      JSON.stringify({
        version: 1,
        diagnostic: {
          completedAt: "2026-08-13T12:00:00.000Z",
          correct: 0,
          total: 8,
          band: 1,
          label: "Word Curious",
        },
        encounters: [
          {
            wordId: "quotidian",
            firstSeenAt: "2026-08-13T12:00:00.000Z",
            lastSeenAt: "2026-08-13T12:00:00.000Z",
            sources: ["diagnostic"],
            status: "learning",
            attempts: 1,
            correct: 0,
          },
        ],
        practiceStreak: 0,
        lastPracticeAt: null,
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Dictionary"));
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));

    const introduction = await screen.findByLabelText(
      "Introduction to quotidian",
    );
    expect(introduction.textContent).toContain(
      "Occurring every day; ordinary or commonplace.",
    );
    expect(
      screen.queryByRole("heading", {
        name: "What does “quotidian” mean?",
      }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Practise this word/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "What does “quotidian” mean?",
      }),
    ).toBeTruthy();
  });

  it("retires each answered application question across Dictionary remounts", async () => {
    window.localStorage.setItem(
      "macdashboard.dictionary.progress.v1",
      JSON.stringify({
        version: 1,
        diagnostic: {
          completedAt: "2026-08-13T12:00:00.000Z",
          correct: 8,
          total: 8,
          band: 5,
          label: "Rare-Word Savant",
        },
        encounters: [],
        practiceStreak: 0,
        lastPracticeAt: null,
        answeredQuestionIds: [],
      }),
    );

    const first = render(<App />);
    fireEvent.click(screen.getByLabelText("Open Dictionary"));
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));
    const introduction = await screen.findByLabelText(/^Introduction to /);
    fireEvent.click(
      introduction.querySelector("button.dictionary-next-button")!,
    );
    const firstPrompt = document.querySelector(
      ".dictionary-exercise-card h2",
    )?.textContent;
    expect(firstPrompt).toBeTruthy();
    const answerButtons = document.querySelectorAll(
      ".dictionary-practice-options button",
    );
    fireEvent.click(answerButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("macdashboard.dictionary.progress.v1")!,
      );
      expect(saved.answeredQuestionIds).toHaveLength(1);
    });

    first.unmount();
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Dictionary"));
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));
    const secondIntroduction = screen.queryByLabelText(/^Introduction to /);
    if (secondIntroduction) {
      fireEvent.click(
        secondIntroduction.querySelector("button.dictionary-next-button")!,
      );
    }
    const secondPrompt = document.querySelector(
      ".dictionary-exercise-card h2",
    )?.textContent;
    expect(secondPrompt).toBeTruthy();
    expect(secondPrompt).not.toBe(firstPrompt);
  });

  it("launches a closed app from the dock", () => {
    render(<App />);

    expect(screen.queryByLabelText("Books window")).toBeNull();
    fireEvent.click(screen.getByLabelText("Open Books"));
    expect(screen.getByLabelText("Books window")).toBeTruthy();
    expect(screen.getByText("A good next book")).toBeTruthy();
  });

  it("immediately uses a created favorite-shows note in TV recommendations", () => {
    window.localStorage.setItem(
      "macdashboard.notes.v1",
      JSON.stringify([
        {
          id: "favorite-shows",
          title: "Favorite Shows",
          folder: "Personal",
          content:
            "<h1>Favorite Shows</h1><ul><li>Detectorists</li></ul>",
          updatedAt: "2026-07-30T12:00:00.000Z",
        },
        ...INITIAL_NOTES,
      ]),
    );

    render(<App />);
    fireEvent.click(screen.getByLabelText("Open TV"));

    const detectoristsCard = screen
      .getAllByRole("button", { name: /Detectorists/i })
      .find((button) => button.classList.contains("watch-card"));
    expect(detectoristsCard).toBeTruthy();
    fireEvent.click(detectoristsCard as HTMLButtonElement);
    expect(
      screen.getByRole("heading", { level: 1, name: "Detectorists" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Evidence match:/i),
    ).toBeTruthy();
    expect(
      document.querySelector(".taste-evidence-quote")?.textContent,
    ).toContain("Detectorists");
    expect(
      document.querySelector(".taste-evidence-quote")?.textContent,
    ).toContain("Favorite Shows");
  });

  it("removes a deleted Note from photo scoring and future discovery queries", async () => {
    window.localStorage.setItem(
      "macdashboard.notes.v1",
      JSON.stringify([
        {
          id: "visual-note",
          title: "Visual inspiration",
          folder: "Personal",
          content:
            "<h1>Visual inspiration</h1><ul><li>misty observatories</li></ul>",
          updatedAt: "2026-07-30T12:00:00.000Z",
        },
        ...INITIAL_NOTES,
      ]),
    );
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return Response.json({
          assistant: {
            configured: false,
            provider: "local",
            status: "local",
            localOnly: true,
          },
        });
      }
      if (url.includes("/api/discover/photos?")) {
        return Response.json({
          source: "Open image collections",
          query: "test",
          items: [],
        });
      }
      if (url.endsWith("/api/assistant")) {
        return Response.json({
          message: "I used only the Notes that exist now.",
          actions: [],
          provider: "local",
          configured: false,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
      void init;
    },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Photos"));
    expect(screen.getByText(/Ranked from \d+ nuanced passages/)).toBeTruthy();
    expect(
      [...document.querySelectorAll(".photo-signal-card")].some((card) =>
        card.textContent?.includes("Visual inspiration"),
      ),
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Close Photos"));

    fireEvent.click(
      screen.getByRole("button", { name: /Visual inspiration/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Visual inspiration" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Note" }));

    fireEvent.click(screen.getByLabelText("Open Photos"));
    expect(screen.queryByText(/misty observatories/)).toBeNull();
    const discoverButton = screen.getByLabelText(
      "Find new attributed images for your aesthetic",
    );
    fireEvent.click(discoverButton);
    await waitFor(() =>
      expect((discoverButton as HTMLButtonElement).disabled).toBe(false),
    );
    expect(
      fetchMock.mock.calls
        .filter(([input]) =>
          String(input).includes("/api/discover/photos?"),
        )
        .some(([input]) =>
          String(input).toLowerCase().includes("misty%20observatories"),
        ),
    ).toBe(false);

    fireEvent.click(screen.getByLabelText("Close Photos"));
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Recommend a photo from all my current Notes." },
    });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(
      (
        await screen.findAllByText(
          "I used only the Notes that exist now.",
        )
      ).length,
    ).toBeGreaterThan(0);
    const assistantCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/assistant"),
    );
    const assistantBody = JSON.parse(
      String(assistantCall?.[1]?.body),
    ) as {
      notes: Array<{ id: string }>;
      tasteDossier: {
        currentNoteCount: number;
        evidence: Array<{ noteId: string; passage: string }>;
      };
    };
    expect(assistantBody.notes.some((note) => note.id === "visual-note")).toBe(
      false,
    );
    expect(
      assistantBody.tasteDossier.evidence.some(
        (item) =>
          item.noteId === "visual-note" ||
          item.passage.toLowerCase().includes("misty observatories"),
      ),
    ).toBe(false);
    expect(assistantBody.tasteDossier.currentNoteCount).toBe(
      assistantBody.notes.length,
    );
  });

  it("actively retrieves relevant note excerpts for Messages queries", async () => {
    window.localStorage.setItem(
      "macdashboard.notes.v1",
      JSON.stringify([
        {
          id: "favorite-shows",
          title: "Favorite Shows",
          folder: "Personal",
          content:
            "<h1>Favorite Shows</h1><ul><li>Severance</li><li>Fleabag</li></ul>",
          updatedAt: "2026-07-30T12:00:00.000Z",
        },
        ...INITIAL_NOTES,
      ]),
    );
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        void _init;
        const url = String(input);
        if (url.endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: true,
                provider: "codex",
                status: "configured",
                localOnly: true,
                codexAuthenticated: true,
                codexThreadPersistent: true,
                codexSandbox: "read-only",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/api/assistant")) {
          return new Response(
            JSON.stringify({
              message: "Your Favorite Shows note points toward sharp character work.",
              actions: [],
              provider: "codex",
              configured: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "What series should I watch based on my notes?" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(
      await screen.findByText(
        "Your Favorite Shows note points toward sharp character work.",
      ),
    ).toBeTruthy();
    const assistantCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/assistant"),
    );
    const requestBody = JSON.parse(
      String(assistantCall?.[1]?.body),
    ) as {
      relevantNotes: Array<{
        id: string;
        title: string;
        excerpt: string;
      }>;
      tasteDossier: {
        currentNoteCount: number;
        evidenceNoteCount: number;
        evidence: Array<{
          noteId: string;
          noteTitle: string;
          passage: string;
          polarity: string;
        }>;
      };
      recommendations: Array<{
        title: string;
        description?: string;
        evidenceSummary?: string;
        sourceNotes?: string[];
      }>;
    };
    expect(requestBody.relevantNotes[0]).toMatchObject({
      id: "favorite-shows",
      title: "Favorite Shows",
    });
    expect(requestBody.relevantNotes[0].excerpt).toContain("Severance");
    expect(requestBody.tasteDossier.currentNoteCount).toBe(
      INITIAL_NOTES.length + 1,
    );
    expect(requestBody.tasteDossier.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          noteId: "favorite-shows",
          noteTitle: "Favorite Shows",
          polarity: "positive",
        }),
      ]),
    );
    expect(requestBody.tasteDossier.evidenceNoteCount).toBeGreaterThan(1);
    expect(requestBody.recommendations[0]).toMatchObject({
      description: expect.any(String),
      evidenceSummary: expect.stringMatching(/Evidence match/),
      sourceNotes: expect.any(Array),
    });
    expect(
      requestBody.recommendations.every(
        (item) =>
          item.description === undefined || item.description.trim().length > 0,
      ),
    ).toBe(true);
    expect(
      requestBody.recommendations.every(
        (item) =>
          item.evidenceSummary === undefined ||
          item.evidenceSummary.trim().length > 0,
      ),
    ).toBe(true);
    expect(
      screen.getByLabelText(/Relevant Notes used: Favorite Shows/),
    ).toBeTruthy();
  });

  it("keeps exactly one active window through focus, minimize, and restore", async () => {
    render(<App />);
    const notes = screen.getByLabelText("Notes window");
    const messages = screen.getByLabelText("Messages window");
    expect(notes.dataset.active).toBe("true");
    expect(messages.dataset.active).toBe("false");

    fireEvent.pointerDown(messages);
    expect(messages.dataset.active).toBe("true");
    expect(notes.dataset.active).toBe("false");

    fireEvent.click(screen.getByLabelText("Open Books"));
    const books = screen.getByLabelText("Books window");
    expect(books.dataset.active).toBe("true");
    const zValues = [notes, messages, books].map((windowElement) =>
      Number(windowElement.style.zIndex),
    );
    expect(new Set(zValues).size).toBe(zValues.length);

    fireEvent.click(screen.getByLabelText("Minimize Books"));
    expect(screen.queryByLabelText("Books window")).toBeNull();
    expect(messages.dataset.active).toBe("true");

    fireEvent.click(screen.getByLabelText("Restore Books"));
    expect((await screen.findByLabelText("Books window")).dataset.active).toBe(
      "true",
    );
    expect(document.querySelectorAll(".app-window[data-active='true']")).toHaveLength(
      1,
    );
  });

  it("keeps keyboard focus, active-window state, and Zoom controls aligned", () => {
    render(<App />);
    const notes = screen.getByLabelText("Notes window");
    const messages = screen.getByLabelText("Messages window");

    fireEvent.focus(screen.getByLabelText("Message"));
    expect(messages.dataset.active).toBe("true");
    expect(notes.dataset.active).toBe("false");

    fireEvent.click(screen.getByLabelText("Zoom Messages"));
    expect(screen.getByLabelText("Restore Messages")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Restore Messages"));
    expect(screen.getByLabelText("Zoom Messages")).toBeTruthy();
  });

  it("switches and restores running apps with Command-Tab", async () => {
    render(<App />);
    expect(screen.getByLabelText("Notes window").dataset.active).toBe("true");

    fireEvent.keyDown(window, { key: "Tab", metaKey: true });
    const switcher = screen.getByLabelText("Application switcher");
    expect(switcher).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /Messages Open/ }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");

    fireEvent.keyUp(window, { key: "Meta" });
    await waitFor(() =>
      expect(screen.getByLabelText("Messages window").dataset.active).toBe(
        "true",
      ),
    );
    expect(screen.queryByLabelText("Application switcher")).toBeNull();

    fireEvent.click(screen.getByLabelText("Minimize Messages"));
    expect(screen.queryByLabelText("Messages window")).toBeNull();

    fireEvent.keyDown(window, { key: "Tab", metaKey: true });
    expect(
      screen.getByRole("option", { name: /Messages Minimized/ }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    fireEvent.keyUp(window, { key: "Meta" });

    await waitFor(() =>
      expect(screen.getByLabelText("Messages window").dataset.active).toBe(
        "true",
      ),
    );
  });

  it("lists running apps in the Window menu and restores a minimized window", async () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Minimize Messages"));
    fireEvent.click(screen.getByLabelText("Window menu"));

    expect(
      screen.getByRole("menuitem", { name: "Active: Notes" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Messages, minimized" }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Messages window").dataset.active).toBe(
        "true",
      ),
    );
  });

  it("clamps open windows when the viewport shrinks", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Photos"));
    const photos = screen.getByLabelText("Photos window");

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 620,
    });
    fireEvent(window, new Event("resize"));

    const left = Number.parseFloat(photos.style.left);
    const top = Number.parseFloat(photos.style.top);
    const width = Number.parseFloat(photos.style.width);
    const height = Number.parseFloat(photos.style.height);
    expect(width).toBeLessThanOrEqual(784);
    expect(height).toBeLessThanOrEqual(510);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(32);
    expect(left + width).toBeLessThanOrEqual(792);
    expect(top + height).toBeLessThanOrEqual(542);
  });

  it("resizes windows from every edge and corner", () => {
    render(<App />);
    const notes = screen.getByLabelText("Notes window");
    const directions = [
      "top edge",
      "bottom edge",
      "right edge",
      "left edge",
      "top-right corner",
      "top-left corner",
      "bottom-right corner",
      "bottom-left corner",
    ];

    directions.forEach((direction) => {
      expect(
        screen.getByLabelText(`Resize Notes from ${direction}`),
      ).toBeTruthy();
    });

    const initialLeft = Number.parseFloat(notes.style.left);
    const initialWidth = Number.parseFloat(notes.style.width);
    fireEvent(
      screen.getByLabelText("Resize Notes from left edge"),
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: initialLeft,
        clientY: 300,
      }),
    );
    fireEvent(
      window,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: initialLeft + 40,
        clientY: 300,
      }),
    );
    fireEvent(window, new MouseEvent("pointerup", { bubbles: true }));

    expect(Number.parseFloat(notes.style.left)).toBe(initialLeft + 40);
    expect(Number.parseFloat(notes.style.width)).toBe(initialWidth - 40);
  });

  it("exposes working macOS-style Window menu actions", () => {
    render(<App />);
    expect(screen.getByLabelText("Notes window")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Window menu"));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Minimize/ }));

    expect(screen.queryByLabelText("Notes window")).toBeNull();
    expect(screen.getByLabelText("Messages window").dataset.active).toBe(
      "true",
    );
  });

  it("supports arrow-key navigation across macOS-style menus", async () => {
    render(<App />);
    const windowTrigger = screen.getByLabelText("Window menu");
    windowTrigger.focus();
    fireEvent.keyDown(windowTrigger, { key: "ArrowDown" });

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("menuitem", { name: /Minimize/ }),
      ),
    );
    fireEvent.keyDown(document.activeElement as Element, {
      key: "ArrowDown",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Zoom" }),
    );
    fireEvent.keyDown(document.activeElement as Element, {
      key: "ArrowRight",
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("menuitem", { name: "Ask Dashboard" }),
      ),
    );
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByLabelText("Help menu"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps a saved book after its window closes and reopens", async () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Books"));
    fireEvent.click(
      screen.getByText("Want to Read", {
        selector: "button.primary-button",
      }),
    );

    fireEvent.click(screen.getByLabelText("Close Books"));
    expect(screen.queryByLabelText("Books window")).toBeNull();
    fireEvent.click(screen.getByLabelText("Open Books"));

    expect(await screen.findByText("In Want to Read")).toBeTruthy();
  });

  it("distinguishes Codex ready from connected and discloses its persistent thread", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        void _init;
        const url = String(input);
        if (url.endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: true,
                provider: "codex",
                model: "gpt-5.6-sol",
                status: "configured",
                localOnly: true,
                codexAuthenticated: true,
                codexThreadPersistent: true,
                codexSandbox: "read-only",
                codexThreadId: "codex-thread-ready-12345678",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/api/assistant")) {
          return new Response(
            JSON.stringify({
              message: "Codex is now connected to this conversation.",
              actions: [],
              provider: "codex",
              model: "gpt-5.6-sol",
              configured: true,
              threadId: "codex-thread-connected-87654321",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("status", {
        name: "Assistant status: Codex ready",
      }),
    ).toBeTruthy();
    const disclosure = screen.getByRole("note", {
      name: "Codex conversation persistence",
    });
    expect(disclosure.textContent).toContain("Persistent Codex thread");
    expect(disclosure.textContent).toContain(
      "Conversation context continues across dashboard restarts.",
    );
    expect(disclosure.textContent).toContain("…12345678");

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Confirm this Codex connection." },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(
      await screen.findByText("Codex is now connected to this conversation."),
    ).toBeTruthy();
    expect(
      await screen.findByRole("status", {
        name: "Assistant status: Codex connected",
      }),
    ).toBeTruthy();
    expect(disclosure.textContent).toContain("…87654321");
  });

  it("starts a new Codex conversation only after explicit confirmation", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: true,
                provider: "codex",
                model: "gpt-5.6-sol",
                status: "connected",
                localOnly: true,
                codexAuthenticated: true,
                codexThreadPersistent: true,
                codexSandbox: "read-only",
                codexThreadId: "codex-thread-existing-11223344",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/api/codex/thread/reset")) {
          expect(init?.method).toBe("POST");
          return new Response(
            JSON.stringify({ ok: true, status: "new_thread_ready" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await screen.findByRole("status", {
      name: "Assistant status: Codex connected",
    });
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", {
      name: "New Codex Conversation",
    }));

    expect(
      screen.getByRole("alert").textContent,
    ).toContain("clears the displayed Messages history");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/codex/thread/reset"),
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Keep This Thread" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByText(/Good afternoon\. Your Preferences note shapes Books/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", {
      name: "New Codex Conversation",
    }));
    fireEvent.click(screen.getByRole("button", {
      name: "Confirm New Conversation",
    }));

    expect(
      await screen.findByText("New Codex conversation ready."),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        /A new Codex conversation is ready\. Your Preferences/,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Good afternoon\. Your Preferences note shapes Books/),
    ).toBeNull();
    expect(
      screen.getByRole("note", {
        name: "Codex conversation persistence",
      }).textContent,
    ).toContain("A new thread begins with your next message");
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/api/codex/thread/reset"),
      ),
    ).toHaveLength(1);
  });

  it("lets the user inspect and explicitly reset learned taste signals", async () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Books"));
    fireEvent.click(screen.getByRole("button", { name: "More like this" }));

    fireEvent.click(screen.getByLabelText("Conversation info"));
    expect(screen.getByText("1 learned taste signal")).toBeTruthy();
    expect(screen.getByText(/Likes:/).textContent).toContain(
      "science fiction",
    );

    fireEvent.click(screen.getByText("Reset Learned Signals"));
    expect(screen.getByText("Confirm Reset")).toBeTruthy();
    fireEvent.click(screen.getByText("Confirm Reset"));

    expect(await screen.findByText("0 learned taste signals")).toBeTruthy();
    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem("macdashboard.feedback.v1") ?? "null",
        ),
      ).toEqual([]),
    );
  });

  it("personalizes from an opt-in chat export without retaining conversation text", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        void _init;
        const url = String(input);
        if (url.endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: false,
                provider: "local",
                status: "local",
                localOnly: true,
                openAIStore: false,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.endsWith("/api/assistant")) {
          return new Response(
            JSON.stringify({
              message: "I used your aggregate chat topics.",
              actions: [],
              provider: "local",
              configured: false,
              fallbackReason: "not_configured",
              retryable: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Conversation info"));
    const input = screen.getByLabelText(
      "Choose a chat export to analyze privately",
    ) as HTMLInputElement;
    const privateSentence =
      "PRIVATE_SENTENCE_TOKEN Ada loved the museum architecture tour";
    const chatFile = new File(["chat"], "messages.csv", {
      type: "text/csv",
    });
    Object.defineProperty(chatFile, "text", {
      value: async () =>
        `Date,Sender,Text\n2026-01-01,Ada,"${privateSentence}"`,
    });

    fireEvent.change(input, { target: { files: [chatFile] } });
    expect(
      await screen.findByText(/Learned 2 aggregate topics from 1 messages/),
    ).toBeTruthy();
    const stored = window.localStorage.getItem(
      "macdashboard.messages.local-signals.v1",
    );
    expect(stored).toContain("architecture and design");
    expect(stored).not.toContain("Ada");
    expect(stored).not.toContain("PRIVATE_SENTENCE_TOKEN");

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Use my interests for a recommendation." },
    });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(
      (
        await screen.findAllByText("I used your aggregate chat topics.")
      ).length,
    ).toBeGreaterThan(0);
    const assistantCall = fetchMock.mock.calls.find(([request]) =>
      String(request).endsWith("/api/assistant"),
    );
    const assistantBody = JSON.parse(
      String(assistantCall?.[1]?.body),
    ) as Record<string, unknown>;
    expect(assistantBody.localChatSignals).toMatchObject({
      messageCount: 1,
      topics: expect.arrayContaining([
        "architecture and design",
        "art and museums",
      ]),
    });
    expect(JSON.stringify(assistantBody)).not.toContain(
      "PRIVATE_SENTENCE_TOKEN",
    );

    fireEvent.click(screen.getByText("Forget Topics"));
    fireEvent.click(screen.getByText("Confirm Forget"));
    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem(
            "macdashboard.messages.local-signals.v1",
          ) ?? "false",
        ),
      ).toBeNull(),
    );
  });

  it("imports reading history locally and reclassifies matching books for rereading", async () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Books"));
    const input = screen.getByLabelText(
      "Choose a reading history export",
    ) as HTMLInputElement;
    const file = new File(["history"], "goodreads_library_export.csv", {
      type: "text/csv",
    });
    Object.defineProperty(file, "text", {
      value: async () =>
        [
          "Title,Author,My Rating,Date Read,Bookshelves,Time Spent",
          '"The Memory Police","Yoko Ogawa",5,2024-02-03,"literary fiction, speculative fiction",240',
        ].join("\n"),
    });

    fireEvent.change(input, { target: { files: [file] } });
    expect(
      await screen.findByText(/Imported 1 private reading entry/),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Return To"));
    expect(
      screen.getAllByText("The Memory Police").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("Close Books"));
    fireEvent.click(screen.getByLabelText("Open Books"));
    fireEvent.click(screen.getByText("Return To"));
    expect(
      screen.getAllByText("The Memory Police").length,
    ).toBeGreaterThan(0);
  });

  it("adds fresh attributed non-AI photo discoveries only when requested", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: false,
              provider: "local",
              status: "local",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/discover/photos?")) {
        return new Response(
          JSON.stringify({
            source: "Wikimedia Commons",
            query: "architecture",
            items: [
              {
                id: "commons-courtyard",
                title: "A blue courtyard",
                url: "https://upload.wikimedia.org/courtyard.jpg",
                sourceUrl:
                  "https://commons.wikimedia.org/wiki/File:Courtyard.jpg",
                creator: "Commons photographer",
                tags: ["architecture", "quiet"],
                reason: "Found through Wikimedia Commons for architecture.",
                license: "CC BY-SA 4.0",
                licenseUrl:
                  "https://creativecommons.org/licenses/by-sa/4.0/",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Photos"));

    expect(screen.queryByText("A blue courtyard")).toBeNull();
    fireEvent.click(
      screen.getByLabelText(
        "Find new attributed images for your aesthetic",
      ),
    );

    expect(await screen.findByText("A blue courtyard")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("architecture"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes(
          "thoughtful%20science%20fiction%20quiet%20architecture",
        ),
      ),
    ).toBe(false);
    const courtyardTile = screen.getByLabelText(
      "Open A blue courtyard by Commons photographer",
    );
    courtyardTile.focus();
    fireEvent.click(courtyardTile);
    expect(screen.getByText("CC BY-SA 4.0")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText("Close photo detail"),
      ),
    );
    fireEvent.keyDown(document.activeElement as Element, {
      key: "Tab",
      shiftKey: true,
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Download" }),
    );
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "A blue courtyard" })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText(
          "Open A blue courtyard by Commons photographer",
        ),
      ),
    );

    fireEvent.click(screen.getByLabelText("Close Photos"));
    fireEvent.click(screen.getByLabelText("Open Photos"));
    expect(await screen.findByText("A blue courtyard")).toBeTruthy();
  });

  it("persists photo dislikes, hides them from For You, and retracts them on undo", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Photos"));

    const tileName = /Open Late-summer shores/;
    fireEvent.click(screen.getByLabelText(tileName));
    fireEvent.click(screen.getByRole("button", { name: "Dislike" }));
    expect(
      screen.getByText(/Showing fewer images like “Late-summer shores”/),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close photo detail"));
    expect(screen.queryByLabelText(tileName)).toBeNull();

    const storedDislikes = JSON.parse(
      window.localStorage.getItem("macdashboard.photos.disliked.v1") ?? "[]",
    ) as string[];
    expect(storedDislikes).toContain("coast");
    const storedFeedback = JSON.parse(
      window.localStorage.getItem("macdashboard.feedback.v1") ?? "[]",
    ) as Array<{ targetId: string; kind: string }>;
    expect(storedFeedback).toContainEqual(
      expect.objectContaining({ targetId: "coast", kind: "dismissed" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Disliked 1/ }));
    fireEvent.click(screen.getByLabelText(tileName));
    fireEvent.click(screen.getByRole("button", { name: "Disliked" }));
    fireEvent.click(screen.getByLabelText("Close photo detail"));
    fireEvent.click(screen.getByRole("button", { name: "For You" }));
    expect(screen.getByLabelText(tileName)).toBeTruthy();

    const feedbackAfterUndo = JSON.parse(
      window.localStorage.getItem("macdashboard.feedback.v1") ?? "[]",
    ) as Array<{ targetId: string; kind: string }>;
    expect(feedbackAfterUndo).not.toContainEqual(
      expect.objectContaining({ targetId: "coast", kind: "dismissed" }),
    );
  });

  it("uses private aggregate signals from explicitly selected local photos", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: false,
              provider: "local",
              status: "local",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/discover/photos?")) {
        return new Response(
          JSON.stringify({ source: "Wikimedia Commons", items: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/assistant")) {
        return new Response(
          JSON.stringify({
            message: "I used your aggregate local photo signals.",
            actions: [],
            provider: "local",
            configured: false,
            fallbackReason: "not_configured",
            retryable: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Photos"));
    const input = screen.getByLabelText(
      "Choose local photos to analyze privately",
    ) as HTMLInputElement;
    const photo = new File(["pixels"], "misty-coastal-architecture.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(input, { target: { files: [photo] } });
    expect(
      await screen.findByText(/Learned 3 aggregate visual signals/),
    ).toBeTruthy();
    const stored = window.localStorage.getItem(
      "macdashboard.photos.local-signals.v1",
    );
    expect(stored).toContain("coastal");
    expect(stored).not.toContain(photo.name);

    fireEvent.click(
      screen.getByLabelText(
        "Find new attributed images for your aesthetic",
      ),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("coastal"),
        ),
      ).toBe(true),
    );

    fireEvent.click(screen.getByLabelText("Close Photos"));
    fireEvent.click(screen.getByLabelText("Open Photos"));
    expect(screen.getByText(/1 photos ·/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "What photo should I look at?" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(
      (
        await screen.findAllByText(
          "I used your aggregate local photo signals.",
        )
      ).length,
    ).toBeGreaterThan(0);
    const assistantCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/assistant"),
    );
    const assistantBody = JSON.parse(
      String(assistantCall?.[1]?.body),
    ) as Record<string, unknown>;
    expect(assistantBody.localPhotoSignals).toMatchObject({
      fileCount: 1,
      tags: expect.arrayContaining(["coastal", "architecture"]),
    });
  });

  it("adds and persists fresh Open Library book candidates only when requested", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: false,
              provider: "local",
              status: "local",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/recommendations/plan")) {
        return new Response(
          JSON.stringify({
            summary:
              "Balanced architecture, memory, and solitude across the current Notes.",
            provider: "codex",
            aiPowered: true,
            candidates: [
              {
                title: "A House of Quiet Rooms",
                creator: "Ada Example",
                mediaType: "book",
                searchQuery: "A House of Quiet Rooms Ada Example",
                fitScore: 91,
                rationale:
                  "Combines architecture and memory without copying a single favorite.",
                evidenceNotes: ["Preferences", "Recent reviews"],
                facets: ["architecture", "memory", "solitude"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/discover/books?")) {
        return new Response(
          JSON.stringify({
            source: "Open Library",
            query: "architecture",
            items: [
              {
                id: "openlibrary-ol123w",
                title: "A House of Quiet Rooms",
                author: "Ada Example",
                year: "2021",
                cover: "https://covers.openlibrary.org/b/id/456-L.jpg",
                genres: ["architecture", "literary fiction"],
                themes: ["memory", "solitude"],
                description: "A house remembers everyone who enters.",
                rating: 4.4,
                kind: "discover",
                sourceUrl: "https://openlibrary.org/works/OL123W",
                sourceLabel: "Open Library",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Books"));

    expect(screen.queryByText("A House of Quiet Rooms")).toBeNull();
    fireEvent.click(screen.getByLabelText("Find new books on Open Library"));

    expect(await screen.findByText("A House of Quiet Rooms")).toBeTruthy();
    const discoveredHero = screen.queryByRole("heading", {
      level: 2,
      name: "A House of Quiet Rooms",
    });
    if (!discoveredHero) {
      fireEvent.click(screen.getByLabelText("Open A House of Quiet Rooms"));
    }
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "A House of Quiet Rooms",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Open Library/ }).getAttribute("href"),
    ).toBe("https://openlibrary.org/works/OL123W");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/discover/books?"),
      ),
    ).toBe(true);

    fireEvent.click(screen.getByLabelText("Close Books"));
    fireEvent.click(screen.getByLabelText("Open Books"));
    expect(await screen.findByText("A House of Quiet Rooms")).toBeTruthy();
  });

  it("keeps Little Women as one anchor without expanding its catalog metadata into the whole profile", async () => {
    window.localStorage.setItem(
      "macdashboard.notes.v1",
      JSON.stringify([
        ...INITIAL_NOTES,
        {
          id: "favorite-books",
          title: "Favorite books",
          folder: "Personal",
          updatedAt: "2026-07-30T12:00:00.000Z",
          content:
            "<h1>Favorite books</h1><ul><li>Little Women</li></ul><p>I also love philosophical mysteries and experimental structure.</p>",
        },
      ]),
    );
    window.localStorage.setItem(
      "macdashboard.books.web.v1",
      JSON.stringify([
        {
          id: "little-women",
          title: "Little Women",
          author: "Louisa May Alcott",
          year: "1868",
          cover: "https://example.com/little-women.jpg",
          genres: ["domestic fiction", "classic"],
          themes: ["sisters", "coming of age"],
          description: "Four sisters grow into adulthood.",
          kind: "discover",
          sourceUrl: "https://openlibrary.org/works/OL29903W",
          sourceLabel: "Open Library",
        },
      ]),
    );
    const plannerBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "codex",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/recommendations/plan")) {
        plannerBodies.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            summary:
              "Little Women contributes warmth and moral seriousness, balanced against mystery and experimentation.",
            provider: "codex",
            aiPowered: true,
            candidates: [
              {
                title: "The Summer Book",
                creator: "Tove Jansson",
                mediaType: "book",
                searchQuery: "The Summer Book Tove Jansson",
                fitScore: 92,
                rationale:
                  "Keeps affectionate intimacy while changing setting, form, era, and author.",
                evidenceNotes: ["Favorite books", "Preferences"],
                facets: ["family intimacy", "experimental form", "quiet"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/discover/books?")) {
        return new Response(
          JSON.stringify({ source: "Open Library", items: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open Books"));
    fireEvent.click(screen.getByLabelText("Find new books on Open Library"));
    await screen.findByText(/No verified catalog matches/);

    expect(plannerBodies).toHaveLength(1);
    const submittedPlan = plannerBodies[0];
    const profile = submittedPlan.profile as {
      interests: string[];
      favorites: string[];
    };
    expect(profile.favorites.map((item) => item.toLowerCase())).toContain(
      "little women",
    );
    expect(profile.interests).not.toEqual(
      expect.arrayContaining([
        "Louisa May Alcott",
        "domestic fiction",
        "classic",
        "sisters",
        "coming of age",
      ]),
    );
    expect(
      (submittedPlan.anchorTitles as string[]).map((item) =>
        item.toLowerCase(),
      ),
    ).toEqual(
      expect.arrayContaining(["little women"]),
    );
    expect(submittedPlan.anchorTitles).not.toEqual(
      expect.arrayContaining([
        "i also love philosophical mysteries and experimental structure",
      ]),
    );
  });

  it("adds and persists fresh web movie and TV candidates only when requested", async () => {
    let releasePlan = () => {};
    const planGate = new Promise<void>((resolve) => {
      releasePlan = resolve;
    });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init;
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: false,
              provider: "local",
              status: "local",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/recommendations/plan")) {
        await planGate;
        return new Response(
          JSON.stringify({
            summary:
              "Balanced patient science fiction with emotional warmth.",
            provider: "codex",
            aiPowered: true,
            candidates: [
              {
                title: "Quiet Future",
                creator: "Example Director",
                mediaType: "movie",
                searchQuery: "Quiet Future 2022",
                fitScore: 92,
                rationale:
                  "Connects patient speculative storytelling with a warm emotional register.",
                evidenceNotes: ["Preferences", "Recent reviews"],
                facets: ["science fiction", "patient", "warm"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/discover/tv?")) {
        return new Response(
          JSON.stringify({
            source: "Apple Search + TMDB",
            sources: ["Apple Search", "TMDB"],
            region: "US",
            tmdbConfigured: true,
            items: [
              {
                id: "apple-movie-42",
                title: "Quiet Future",
                year: "2022",
                artwork: "https://is1-ssl.mzstatic.com/quiet.jpg",
                genres: ["science fiction", "movie"],
                moods: ["thoughtful"],
                runtime: "1 hr 49 min",
                description: "A patient story.",
                kind: "discover",
                mediaType: "movie",
                platforms: ["Max"],
                providers: [{ name: "Max", type: "subscription" }],
                sourceUrl: "https://tv.apple.com/us/movie/quiet/umc.42",
                sourceLabel: "View on Apple TV",
                sourceLinks: [
                  {
                    label: "Where to watch in US",
                    url: "https://www.themoviedb.org/movie/42/watch",
                  },
                  {
                    label: "View on Apple TV",
                    url: "https://tv.apple.com/us/movie/quiet/umc.42",
                  },
                ],
                providerAttribution:
                  "Streaming availability by JustWatch · Title data from TMDB",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open TV"));

    expect(screen.queryByText("Quiet Future")).toBeNull();
    const tvSearch = screen.getByLabelText("Search TV recommendations");
    fireEvent.change(tvSearch, { target: { value: "Quiet Future" } });
    fireEvent.keyDown(tvSearch, { key: "Enter" });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/discover/tv?q=Quiet%20Future"),
        ),
      ).toBe(true),
    );
    releasePlan();
    expect((await screen.findAllByText("Quiet Future")).length).toBeGreaterThan(
      0,
    );
    const planningCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/recommendations/plan"),
    );
    expect(JSON.parse(String(planningCall?.[1]?.body))).toMatchObject({
      domain: "tv",
      userQuery: "Quiet Future",
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/discover/tv?q=Quiet%20Future"),
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Quiet Future/ }));
    expect(
      screen.getByLabelText("Filter recommendations by platform"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Available from Max")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Where to watch in US/ })
        .getAttribute("href"),
    ).toBe("https://www.themoviedb.org/movie/42/watch");
    expect(
      screen
        .getByRole("link", { name: /View on Apple TV/ })
        .getAttribute("href"),
    ).toBe("https://tv.apple.com/us/movie/quiet/umc.42");

    fireEvent.click(screen.getByLabelText("Close TV"));
    fireEvent.click(screen.getByLabelText("Open TV"));
    expect((await screen.findAllByText("Quiet Future")).length).toBeGreaterThan(
      0,
    );
  });

  it("grounds an imported non-catalog watch in Apple metadata for rewatching", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: false,
              provider: "local",
              status: "local",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/recommendations/plan")) {
        return new Response(
          JSON.stringify({
            summary:
              "Balanced the imported rewatch signal with the broader profile.",
            provider: "codex",
            aiPowered: true,
            candidates: [
              {
                title: "A Completely New Show",
                creator: "Example Creator",
                mediaType: "series",
                searchQuery: "A Completely New Show 2024",
                fitScore: 94,
                rationale:
                  "The viewing history makes this a timely rewatch without displacing the rest of the profile.",
                evidenceNotes: ["Preferences", "Recent reviews"],
                facets: ["rewatch", "patient drama", "quiet"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/discover/tv?")) {
        return new Response(
          JSON.stringify({
            source: "Apple Search",
            items: [
              {
                id: "apple-tv-84",
                title: "A Completely New Show",
                year: "2024",
                artwork: "https://is1-ssl.mzstatic.com/new-show.jpg",
                genres: ["drama", "television"],
                moods: ["patient"],
                runtime: "TV series",
                description: "A quiet, patient drama.",
                kind: "discover",
                sourceUrl:
                  "https://tv.apple.com/us/show/a-completely-new-show/umc.84",
                sourceLabel: "View on Apple TV",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByLabelText("Open TV"));
    const historyInput = screen.getByLabelText(
      "Choose a viewing history export",
    ) as HTMLInputElement;
    const historyFile = new File(["history"], "NetflixViewingHistory.csv", {
      type: "text/csv",
    });
    Object.defineProperty(historyFile, "text", {
      value: async () =>
        [
          "Title,Date",
          '"A Completely New Show: Season 1: Pilot","2025-03-04"',
        ].join("\n"),
    });

    fireEvent.change(historyInput, { target: { files: [historyFile] } });
    expect(
      await screen.findByText(/Imported 1 private history entry/),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByLabelText(
        "Find new movies and shows across streaming platforms",
      ),
    );

    expect(
      await screen.findByText(
        /Added 1 fresh title from Apple Search/,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Rewatch"));
    expect(
      window.localStorage.getItem("macdashboard.tv.web.v1"),
    ).toContain("A Completely New Show");
    expect(
      window.localStorage.getItem("macdashboard.tv.history.v1"),
    ).toContain("A Completely New Show");
    expect(
      await screen.findByRole("heading", {
        name: "A Completely New Show",
        level: 1,
      }),
    ).toBeTruthy();
    expect(screen.getByText("Time for a return")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("A%20Completely%20New%20Show"),
      ),
    ).toBe(true);
  });

  it("handles a simple request in Messages and opens the requested app", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: false,
                provider: "local",
                status: "local",
                localOnly: true,
                openAIStore: false,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            message:
              "I opened Photos. Every image there comes from a traceable web source—none are AI-generated.",
            actions: [{ type: "open_app", app: "photos" }],
            provider: "local",
            configured: false,
            fallbackReason: "not_configured",
            retryable: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Show me a photo recommendation" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() =>
      expect(screen.getByLabelText("Photos window")).toBeTruthy(),
    );
    expect(
      screen.getByText(
        "I opened Photos. Every image there comes from a traceable web source—none are AI-generated.",
      ),
    ).toBeTruthy();
  });

  it("applies safe AI actions while keeping note bodies out of ordinary requests", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: true,
                provider: "openai",
                model: "gpt-5.6-sol",
                status: "configured",
                localOnly: true,
                openAIStore: false,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (url.endsWith("/api/assistant")) {
          return new Response(
            JSON.stringify({
              message: "I opened Books and prepared a preference suggestion.",
              actions: [
                { type: "open_app", app: "books" },
                {
                  type: "update_preferences",
                  suggestion: "Interests: courtyard houses",
                  reason: "You explicitly said you love them.",
                },
              ],
              provider: "openai",
              model: "gpt-5.6-sol",
              configured: true,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "I love courtyard houses. Open Books." },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByLabelText("Books window")).toBeTruthy();
    expect(
      await screen.findByText("Interests: courtyard houses"),
    ).toBeTruthy();
    expect(await screen.findByText("gpt-5.6-sol")).toBeTruthy();

    fireEvent.click(screen.getByText("Add to Preferences"));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Edit Preferences").textContent,
      ).toContain("courtyard houses"),
    );
    expect(screen.getByText("Added to Preferences")).toBeTruthy();

    const assistantCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/assistant"),
    );
    const requestBody = JSON.parse(
      String(assistantCall?.[1]?.body),
    ) as Record<string, unknown>;
    const notes = requestBody.notes as Array<Record<string, unknown>>;
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]).not.toHaveProperty("content");
    const reviews = requestBody.reviews as Array<Record<string, unknown>>;
    expect(reviews.some((review) => review.title === "Piranesi")).toBe(true);
    expect(reviews[0]).not.toHaveProperty("summary");
  });

  it("lets the assistant navigate an app view and enter a validated search", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "openai",
              model: "gpt-5.6-sol",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          message: "I opened your reread shelf and searched for Piranesi.",
          actions: [
            { type: "set_app_view", app: "books", view: "reread" },
            { type: "search_app", app: "books", query: "Piranesi" },
            { type: "select_item", app: "books", itemId: "piranesi" },
          ],
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Find Piranesi on my reread shelf" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByLabelText("Books window")).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Search book recommendations") as HTMLInputElement)
          .value,
      ).toBe("Piranesi"),
    );
    expect(screen.getByText("Worth returning to")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Piranesi" })).toBeTruthy();
  });

  it("reviews a grounded AI library change before persisting it", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      if (String(input).endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "openai",
              model: "gpt-5.6-sol",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          message: "I prepared Piranesi for your Want to Read list.",
          actions: [
            {
              type: "update_library",
              app: "books",
              itemId: "piranesi",
              operation: "add",
              reason: "You explicitly asked to save this recommendation.",
            },
          ],
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Add Piranesi to Want to Read" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByText("Review library change")).toBeTruthy();
    expect(
      screen.getByText(/Add “Piranesi” to Want to Read/),
    ).toBeTruthy();
    expect(
      window.localStorage.getItem("macdashboard.books.saved.v1"),
    ).toBeNull();

    fireEvent.click(screen.getByText("Confirm Change"));
    expect(await screen.findByLabelText("Books window")).toBeTruthy();
    expect(await screen.findByText("In Want to Read")).toBeTruthy();
    expect(
      JSON.parse(
        window.localStorage.getItem("macdashboard.books.saved.v1") ?? "[]",
      ),
    ).toContain("piranesi");
    expect(screen.getByText("Library updated")).toBeTruthy();
  });

  it("sends an explicitly selected image to the assistant with a visible preview", async () => {
    const fetchMock = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      void init;
      const url = String(input);
      if (url.endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "openai",
              model: "gpt-5.6-sol",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          message: "The image has quiet architectural lines.",
          actions: [],
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<App />);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept="image/*"]',
    );
    const pngBytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZFYAAAAASUVORK5CYII=",
      ),
      (character) => character.charCodeAt(0),
    );
    const file = new File([pngBytes], "quiet-room.png", {
      type: "image/png",
    });

    fireEvent.change(input!, { target: { files: [file] } });
    expect(await screen.findByText(/quiet-room\.png/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "What do you notice?" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByAltText("quiet-room.png")).toBeTruthy();
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([request]) =>
        String(request).endsWith("/api/assistant"),
      );
      expect(call).toBeTruthy();
      const body = JSON.parse(String(call?.[1]?.body)) as {
        messages: Array<Record<string, unknown>>;
      };
      expect(body.messages.at(-1)?.image).toMatchObject({
        name: "quiet-room.png",
        mimeType: "image/png",
      });
    });
  });

  it("supports persistent Tapbacks and a real emoji picker in Messages", () => {
    render(<App />);
    const messageBubble = screen.getAllByTitle(
      "Double-click or right-click for message actions",
    )[0];

    fireEvent.doubleClick(messageBubble);
    fireEvent.click(screen.getByLabelText("Add thumbs up reaction"));
    expect(screen.getByText("👍")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Add emoji"));
    fireEvent.click(screen.getByLabelText("Insert ✨"));
    expect((screen.getByLabelText("Message") as HTMLInputElement).value).toBe(
      "✨",
    );

    fireEvent.click(screen.getByLabelText("Close Messages"));
    fireEvent.click(screen.getByLabelText("Open Messages"));
    expect(screen.getByText("👍")).toBeTruthy();
  });

  it("requires confirmation before deleting an individual message", () => {
    render(<App />);
    const greeting = screen.getByLabelText(
      /Dashboard: Good afternoon\. Your Preferences note shapes Books/,
    );

    fireEvent.contextMenu(greeting);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete message" }));
    expect(
      screen.getByRole("alertdialog", { name: "Delete this message?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByText(/Good afternoon\. Your Preferences note shapes Books/),
    ).toBeTruthy();

    fireEvent.contextMenu(greeting);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete message" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.queryByText(/Good afternoon\. Your Preferences note shapes Books/),
    ).toBeNull();
    expect(window.localStorage.getItem("macdashboard.messages.v1")).toBe("[]");
  });

  it("requires review before applying an AI-proposed note edit", async () => {
    const fetchMock = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      void init;
      if (String(input).endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "openai",
              model: "gpt-5.6-sol",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          message: "I prepared an addition for your draft.",
          actions: [
            {
              type: "propose_note_edit",
              noteId: "welcome",
              mode: "append",
              content: "A courtyard can make silence feel intentional.",
              reason: "This develops the architectural image in your draft.",
            },
          ],
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /A room for unfinished thoughts/,
      }),
    );

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Suggest an addition to my unfinished thoughts note" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(
      await screen.findByText(
        "A courtyard can make silence feel intentional.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Edit A room for unfinished thoughts").textContent,
    ).not.toContain("courtyard can make");

    fireEvent.click(screen.getByText("Add to Note"));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Edit A room for unfinished thoughts")
          .textContent,
      ).toContain("courtyard can make"),
    );
    expect(screen.getByText("Applied to Notes")).toBeTruthy();
  });

  it("requires review before creating an AI-proposed note", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "openai",
              model: "gpt-5.6-sol",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          message: "I drafted a new note for your review.",
          actions: [
            {
              type: "propose_note_create",
              title: "Courtyard sequence",
              folder: "Ideas",
              content: "Map the threshold, garden, and reading room.",
              reason: "You asked me to preserve this thought.",
            },
          ],
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Create a note about a courtyard sequence" },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByText("Courtyard sequence")).toBeTruthy();
    expect(
      screen.queryByLabelText("Edit Courtyard sequence"),
    ).toBeNull();

    fireEvent.click(screen.getByText("Create Note"));
    expect(await screen.findByLabelText("Edit Courtyard sequence")).toBeTruthy();
    expect(screen.getByText("Created in Notes")).toBeTruthy();
    expect(
      screen.getByLabelText("Edit Courtyard sequence").textContent,
    ).toContain("Map the threshold, garden, and reading room.");
  });

  it("requires one-request consent before Messages shares a note body", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      if (String(input).endsWith("/api/config")) {
        return new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "openai",
              model: "gpt-5.6-sol",
              status: "configured",
              localOnly: true,
              openAIStore: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          message: "I can help develop the architectural image.",
          actions: [],
          provider: "openai",
          model: "gpt-5.6-sol",
          configured: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: {
        value: "Help me rewrite my unfinished thoughts note",
      },
    });
    fireEvent.click(screen.getByLabelText("Send message"));

    expect(await screen.findByText("Permission required")).toBeTruthy();
    expect(
      screen.getAllByText("A room for unfinished thoughts").length,
    ).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/api/assistant"),
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByText("Share Note Once"));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/api/assistant"),
        ),
      ).toHaveLength(1),
    );
    const assistantCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/assistant"),
    );
    const request = JSON.parse(String(assistantCall?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(request.messages.at(-1)?.content).toContain(
      "BEGIN USER-AUTHORIZED NOTE CONTENT",
    );
    expect(request.messages.at(-1)?.content).toContain(
      "dashboard should feel less like a feed",
    );
    expect(screen.getByText("Shared for one request")).toBeTruthy();
  });

  it("shares a note sketch with the assistant only after the user clicks Ask", async () => {
    window.localStorage.setItem(
      "macdashboard.notes.v1",
      JSON.stringify([
        {
          id: "preferences",
          title: "Preferences",
          folder: "Personal",
          content: "<h1>Preferences</h1><p>Interests: architecture</p>",
          updatedAt: "2026-07-29T12:00:00.000Z",
        },
        {
          id: "concept-map",
          title: "Concept Map",
          folder: "Ideas",
          content: "<h1>Concept Map</h1><p>A courtyard joins the rooms.</p>",
          updatedAt: "2026-07-29T12:00:00.000Z",
          sketch: {
            version: 1,
            strokes: [
              {
                id: "line",
                color: "#202124",
                width: 4,
                points: [
                  { x: 20, y: 30 },
                  { x: 180, y: 140 },
                ],
              },
            ],
          },
        },
      ]),
    );
    const context = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "round",
      lineJoin: "round",
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        if (String(input).endsWith("/api/config")) {
          return new Response(
            JSON.stringify({
              assistant: {
                configured: true,
                provider: "openai",
                model: "gpt-5.6-sol",
                status: "configured",
                localOnly: true,
                openAIStore: false,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            message: "I can see the relationship in your sketch.",
            actions: [],
            provider: "openai",
            model: "gpt-5.6-sol",
            configured: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Concept Map/ }));
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/api/assistant"),
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByLabelText("Ask for help with this note"));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/api/assistant"),
        ),
      ).toHaveLength(1),
    );
    const assistantCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/assistant"),
    );
    const request = JSON.parse(String(assistantCall?.[1]?.body)) as {
      messages: Array<{
        content: string;
        image?: { mimeType: string; dataUrl: string };
      }>;
      notes: Array<{ id: string; hasSketch?: boolean; content?: string }>;
    };
    expect(request.messages.at(-1)?.content).toContain(
      "This note also has an attached sketch with 1 stroke.",
    );
    expect(request.messages.at(-1)?.image).toEqual(
      expect.objectContaining({
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    );
    expect(
      request.notes.find((note) => note.id === "concept-map"),
    ).toMatchObject({ hasSketch: true });
    expect(request.notes.every((note) => !("content" in note))).toBe(true);
  });
});
