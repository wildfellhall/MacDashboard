import { describe, expect, it, vi } from "vitest";
import {
  createPhotoDiscoveryService,
  mapArtInstituteResponse,
  mapCommonsResponse,
  mapMetObject,
  mapOpenverseResponse,
} from "./photoDiscovery.js";

const commonsPayload = {
  query: {
    pages: [
      {
        pageid: 42,
        title: "File:Quiet courtyard.jpg",
        imageinfo: [
          {
            thumburl:
              "https://upload.wikimedia.org/example/quiet-courtyard.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Quiet_courtyard.jpg",
            user: "Example contributor",
            extmetadata: {
              Artist: { value: "<b>Ada Example</b>" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: {
                value:
                  "https://creativecommons.org/licenses/by-sa/4.0/",
              },
              ImageDescription: {
                value: "<p>A quiet stone courtyard.</p>",
              },
            },
          },
        ],
      },
    ],
  },
};

const openversePayload = {
  results: [
    {
      id: "9f684fa7-5132-4dce-965e-15cd1de7af42",
      title: "Quiet courtyard in amber light",
      foreign_landing_url: "https://www.flickr.com/photos/example/42",
      url: "https://live.staticflickr.com/example/42.jpg",
      thumbnail:
        "https://api.openverse.org/v1/images/9f684fa7-5132-4dce-965e-15cd1de7af42/thumb/",
      creator: "Ada Example",
      license: "by-sa",
      license_version: "4.0",
      license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
      source: "flickr",
      mature: false,
      tags: [{ name: "courtyard" }, { name: "minimal" }],
    },
  ],
};

const articPayload = {
  config: { iiif_url: "https://www.artic.edu/iiif/2" },
  data: [
    {
      id: 27992,
      title: "A Quiet Garden",
      image_id: "2d484387-2509-5e8e-2c43-22f9981972eb",
      artist_title: "Ada Painter",
      date_display: "1901",
      is_public_domain: true,
      classification_title: "painting",
      medium_display: "Oil on canvas",
    },
  ],
};

const metObject = {
  objectID: 437133,
  isPublicDomain: true,
  primaryImageSmall:
    "https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg",
  objectURL:
    "https://www.metmuseum.org/art/collection/search/437133",
  title: "Cypresses at Dusk",
  artistDisplayName: "Ada Artist",
  objectName: "Painting",
  classification: "Paintings",
  department: "European Paintings",
  tags: [{ term: "Trees" }, { term: "Evening" }],
};

describe("open image response mapping", () => {
  it("maps only safe attributed Wikimedia Commons records", () => {
    expect(mapCommonsResponse(commonsPayload, "quiet architecture")).toEqual([
      expect.objectContaining({
        id: "commons-42",
        title: "Quiet courtyard",
        creator: "Ada Example",
        tags: ["quiet", "architecture", "wikimedia commons"],
        license: "CC BY-SA 4.0",
      }),
    ]);

    const poisoned = structuredClone(commonsPayload);
    poisoned.query.pages[0].imageinfo[0].thumburl =
      "https://example.com/tracker.jpg";
    expect(mapCommonsResponse(poisoned, "quiet architecture")).toEqual([]);
  });

  it("maps safe, attributed Openverse records", () => {
    expect(
      mapOpenverseResponse(openversePayload, "quiet architecture"),
    ).toEqual([
      expect.objectContaining({
        id: "openverse-9f684fa7-5132-4dce-965e-15cd1de7af42",
        creator: "Ada Example",
        license: "CC BY-SA 4.0",
        tags: expect.arrayContaining(["courtyard", "minimal", "openverse"]),
      }),
    ]);

    const poisoned = structuredClone(openversePayload);
    poisoned.results[0].foreign_landing_url = "javascript:alert(1)";
    expect(
      mapOpenverseResponse(poisoned, "quiet architecture"),
    ).toEqual([]);
  });

  it("maps only public-domain Art Institute IIIF images", () => {
    expect(
      mapArtInstituteResponse(articPayload, "quiet garden"),
    ).toEqual([
      expect.objectContaining({
        id: "artic-27992",
        title: "A Quiet Garden",
        url:
          "https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg",
        sourceUrl: "https://www.artic.edu/artworks/27992",
        creator: "Ada Painter · Art Institute of Chicago",
        license: "Public Domain",
      }),
    ]);

    const copyrighted = structuredClone(articPayload);
    copyrighted.data[0].is_public_domain = false;
    expect(mapArtInstituteResponse(copyrighted, "quiet garden")).toEqual([]);
  });

  it("maps only public-domain Met Open Access images", () => {
    expect(mapMetObject(metObject, "evening trees")).toMatchObject({
      id: "met-437133",
      title: "Cypresses at Dusk",
      creator: "Ada Artist · The Metropolitan Museum of Art",
      tags: expect.arrayContaining(["evening", "trees", "the met"]),
      license: "Public Domain · The Met Open Access",
    });

    expect(
      mapMetObject({ ...metObject, isPublicDomain: false }, "evening trees"),
    ).toBeNull();
  });
});

describe("multi-source photo discovery", () => {
  const successfulFetch = vi.fn(async (url, init) => {
    expect(init.headers["User-Agent"]).toContain("MacDashboard");
    const parsed = new URL(url);
    if (parsed.hostname === "api.openverse.org") {
      return Response.json(openversePayload);
    }
    if (parsed.hostname === "commons.wikimedia.org") {
      return Response.json(commonsPayload);
    }
    if (parsed.hostname === "api.artic.edu") {
      return Response.json(articPayload);
    }
    if (parsed.pathname.endsWith("/search")) {
      return Response.json({ total: 1, objectIDs: [437133] });
    }
    return Response.json(metObject);
  });

  it("fans out, interleaves sources, and caches repeated searches", async () => {
    const fetchImpl = vi.fn(successfulFetch);
    const service = createPhotoDiscoveryService({ fetchImpl });

    const first = await service.search("quiet architecture");
    await expect(service.search("quiet architecture")).resolves.toEqual(first);

    expect(first.map((item) => item.id)).toEqual([
      "openverse-9f684fa7-5132-4dce-965e-15cd1de7af42",
      "commons-42",
      "artic-27992",
      "met-437133",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(service.sources).toEqual([
      "Openverse",
      "Wikimedia Commons",
      "Art Institute of Chicago",
      "The Met Open Access",
    ]);
  });

  it("keeps working sources when another provider is offline", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const parsed = new URL(url);
      if (parsed.hostname === "api.openverse.org") {
        return new Response("offline", { status: 503 });
      }
      return successfulFetch(url, init);
    });
    const service = createPhotoDiscoveryService({ fetchImpl });

    const items = await service.search("quiet architecture");
    expect(items.map((item) => item.id)).toEqual([
      "commons-42",
      "artic-27992",
      "met-437133",
    ]);
  });

  it("fails clearly only when every source is unavailable", async () => {
    const service = createPhotoDiscoveryService({
      fetchImpl: vi.fn(async () => new Response("offline", { status: 503 })),
    });

    await expect(service.search("quiet architecture")).rejects.toThrow(
      "All open image sources were unavailable",
    );
  });
});
