import type {
  AppMeta,
  Book,
  Message,
  Note,
  PhotoItem,
  WatchItem,
} from "./types";

export const APPS: AppMeta[] = [
  {
    id: "messages",
    name: "Messages",
    subtitle: "Ask the dashboard",
    color: "#35c759",
  },
  {
    id: "notes",
    name: "Notes",
    subtitle: "Write & shape ideas",
    color: "#f7c52f",
  },
  {
    id: "photos",
    name: "Photos",
    subtitle: "A visual discovery album",
    color: "#ec5e69",
  },
  {
    id: "books",
    name: "Books",
    subtitle: "Read next, return well",
    color: "#ff754b",
  },
  {
    id: "tv",
    name: "TV",
    subtitle: "Watch with intention",
    color: "#151518",
  },
];

export const INITIAL_NOTES: Note[] = [
  {
    id: "preferences",
    title: "Preferences",
    folder: "Personal",
    pinned: true,
    updatedAt: new Date().toISOString(),
    content:
      "<h1>Preferences</h1><p>This note is the source of truth for your dashboard. Edit the lines below and recommendations will adapt.</p><h2>Profile</h2><p><strong>Interests:</strong> thoughtful science fiction, quiet architecture, art history, literary mysteries, coastal landscapes</p><p><strong>Moods:</strong> contemplative, curious, warm, visually lush</p><p><strong>Favorites:</strong> layered characters, precise prose, atmospheric photography, intelligent comedy</p><p><strong>Avoid:</strong> gratuitous violence, cynical endings, generic self-help</p><h2>Privacy</h2><p>Local data stays on this device. Imports are opt-in and recommendations should always explain themselves.</p>",
  },
  {
    id: "welcome",
    title: "A room for unfinished thoughts",
    folder: "Ideas",
    updatedAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    content:
      "<h1>A room for unfinished thoughts</h1><p>Use this space for a paragraph, a plan, or the beginning of something stranger.</p><blockquote>The dashboard should feel less like a feed and more like a room with a point of view.</blockquote><p>Open Messages whenever you want help shaping a note.</p>",
  },
  {
    id: "reviews",
    title: "Recent reviews",
    folder: "Reviews",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    content:
      "<h1>Recent reviews</h1><h2>Piranesi — 5/5</h2><p>Read: 2023-02-12. Dreamlike, humane, and architecturally fascinating. I loved the compact scale and emotional turn.</p><h2>Arrival — 4.5/5</h2><p>Watched: 2022-11-18. Patient science fiction where form and feeling are inseparable.</p>",
  },
];

export const BOOKS: Book[] = [
  {
    id: "memory-police",
    title: "The Memory Police",
    author: "Yoko Ogawa",
    year: "1994",
    cover:
      "https://covers.openlibrary.org/b/isbn/9781101911815-L.jpg",
    genres: ["literary fiction", "speculative fiction"],
    themes: ["memory", "identity", "quiet resistance"],
    description:
      "On an unnamed island, objects disappear—and most people forget they ever existed.",
    kind: "discover",
  },
  {
    id: "sea-of-tranquility",
    title: "Sea of Tranquility",
    author: "Emily St. John Mandel",
    year: "2022",
    cover:
      "https://covers.openlibrary.org/b/isbn/9780593321447-L.jpg",
    genres: ["science fiction", "literary fiction"],
    themes: ["time", "art", "connection"],
    description:
      "A compact time-travel novel linking lives across centuries and colonies.",
    kind: "discover",
  },
  {
    id: "name-of-rose",
    title: "The Name of the Rose",
    author: "Umberto Eco",
    year: "1980",
    cover:
      "https://covers.openlibrary.org/b/isbn/9780544176560-L.jpg",
    genres: ["historical fiction", "mystery"],
    themes: ["books", "knowledge", "architecture"],
    description:
      "A murder mystery, an intellectual labyrinth, and a library worth getting lost in.",
    kind: "discover",
  },
  {
    id: "piranesi",
    title: "Piranesi",
    author: "Susanna Clarke",
    year: "2020",
    cover:
      "https://covers.openlibrary.org/b/isbn/9781635577808-L.jpg",
    genres: ["fantasy", "literary fiction"],
    themes: ["architecture", "memory", "solitude"],
    description:
      "A return to the infinite House may reveal details that only time makes visible.",
    rating: 5,
    lastRead: "2023-02-12",
    minutes: 286,
    kind: "reread",
  },
];

export const WATCH_ITEMS: WatchItem[] = [
  {
    id: "after-yang",
    title: "After Yang",
    year: "2021",
    artwork:
      "https://image.tmdb.org/t/p/w780/qjEuDeKOhA7JqaaqhLSfoS9titb.jpg",
    genres: ["science fiction", "drama"],
    moods: ["contemplative", "warm", "visually lush"],
    runtime: "1 hr 36 min",
    description:
      "A family examines memory, grief, and connection after their android companion stops working.",
    kind: "discover",
  },
  {
    id: "detectorists",
    title: "Detectorists",
    year: "2014",
    artwork:
      "https://image.tmdb.org/t/p/w780/5WwgmYwBPL9v8syPjQTIZVRTmpp.jpg",
    genres: ["comedy", "drama"],
    moods: ["gentle", "warm", "intelligent comedy"],
    runtime: "29 min episodes",
    description:
      "Two friends search the English countryside for treasure and find a quiet, funny life instead.",
    kind: "discover",
  },
  {
    id: "arrival",
    title: "Arrival",
    year: "2016",
    artwork:
      "https://image.tmdb.org/t/p/w780/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
    genres: ["science fiction", "drama"],
    moods: ["contemplative", "emotional"],
    runtime: "1 hr 56 min",
    description:
      "Language, time, and love reward a return with foreknowledge.",
    kind: "rewatch",
    lastWatched: "2022-11-18",
    rating: 4.5,
  },
];

export const PHOTOS: PhotoItem[] = [
  {
    id: "coast",
    title: "Late-summer shores",
    url:
      "https://images.unsplash.com/photo-1597860150045-3e4760e52ed5?auto=format&fit=crop&w=1400&q=86",
    sourceUrl:
      "https://unsplash.com/photos/river-in-between-brown-and-green-trees-during-daytime-E7p8s1gknio",
    creator: "Red Zeppelin · Unsplash",
    tags: ["coastal landscapes", "atmospheric photography"],
    reason: "Matches coastal landscapes and a preference for quiet, atmospheric images.",
  },
  {
    id: "architecture",
    title: "Perspective in red",
    url:
      "https://images.unsplash.com/photo-1486718448742-163732cd1544?auto=format&fit=crop&w=1400&q=86",
    sourceUrl:
      "https://unsplash.com/photos/minimalist-photography-of-brown-wavy-structure-PzYiCWOHtfU",
    creator: "Ricardo Gomez Angel · Unsplash",
    tags: ["quiet architecture", "minimalism"],
    reason: "Connects your interest in quiet architecture with restrained visual geometry.",
  },
  {
    id: "museum",
    title: "An afternoon with paintings",
    url:
      "https://images.unsplash.com/photo-1606819717115-9159c900370b?auto=format&fit=crop&w=1400&q=86",
    sourceUrl:
      "https://unsplash.com/photos/woman-in-black-coat-standing-in-front-of-paintings-1xp5VxvyKL0",
    creator: "Zalfa Imani · Unsplash",
    tags: ["art history", "museum", "warm"],
    reason: "Bridges art history, warm interiors, and an unhurried museum mood.",
  },
  {
    id: "library",
    title: "A room made of books",
    url:
      "https://images.unsplash.com/photo-1613324766451-2d03b2ea8190?auto=format&fit=crop&w=1400&q=86",
    sourceUrl:
      "https://unsplash.com/photos/brown-wooden-book-shelf-with-books-Vpz_i_tpPiM",
    creator: "Zach Plank · Unsplash",
    tags: ["books", "architecture", "contemplative"],
    reason: "A visual overlap between books, architecture, and contemplative spaces.",
  },
  {
    id: "fog",
    title: "A walk into fog",
    url:
      "https://images.unsplash.com/photo-1486707471592-8e7eb7e36f78?auto=format&fit=crop&w=1400&q=86",
    sourceUrl:
      "https://unsplash.com/photos/gray-forest-with-fog-kbKEuU-YEIw",
    creator: "Inggrid Koe · Unsplash",
    tags: ["landscape", "contemplative", "atmospheric photography"],
    reason: "A calm, layered landscape for your contemplative and visually lush moods.",
  },
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: "m1",
    sender: "assistant",
    body:
      "Good afternoon. Your Preferences note shapes Books, Photos, and TV locally. Ask for a recommendation, open a note, or tell me what kind of mood you’re in.",
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
];
