import AppKit
import Foundation

struct IconSource {
    let name: String
    let path: String
    let usesWorkspaceRendering: Bool
}

let outputPath = CommandLine.arguments.dropFirst().first ?? "public/local-icons"
let outputURL = URL(fileURLWithPath: outputPath, isDirectory: true)
let fileManager = FileManager.default

let sources = [
    IconSource(
        name: "messages",
        path: "/System/Applications/Messages.app",
        usesWorkspaceRendering: true
    ),
    IconSource(
        name: "notes",
        path: "/System/Applications/Notes.app",
        usesWorkspaceRendering: true
    ),
    IconSource(
        name: "photos",
        path: "/System/Applications/Photos.app",
        usesWorkspaceRendering: true
    ),
    IconSource(
        name: "books",
        path: "/System/Applications/Books.app",
        usesWorkspaceRendering: true
    ),
    IconSource(
        name: "tv",
        path: "/System/Applications/TV.app",
        usesWorkspaceRendering: true
    ),
    IconSource(
        name: "dictionary",
        path: "/System/Applications/Dictionary.app",
        usesWorkspaceRendering: true
    ),
    IconSource(
        name: "trash-empty",
        path: "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/TrashIcon.icns",
        usesWorkspaceRendering: false
    ),
    IconSource(
        name: "trash-full",
        path: "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/FullTrashIcon.icns",
        usesWorkspaceRendering: false
    ),
]

func render(_ image: NSImage, to destination: URL) throws {
    let pixels = 512
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixels,
        pixelsHigh: pixels,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        throw NSError(domain: "MacDashboardIcons", code: 1)
    }

    bitmap.size = NSSize(width: pixels, height: pixels)
    guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw NSError(domain: "MacDashboardIcons", code: 2)
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: pixels, height: pixels).fill()
    image.draw(
        in: NSRect(x: 0, y: 0, width: pixels, height: pixels),
        from: .zero,
        operation: .copy,
        fraction: 1,
        respectFlipped: true,
        hints: [.interpolation: NSImageInterpolation.high]
    )
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "MacDashboardIcons", code: 3)
    }
    try data.write(to: destination, options: .atomic)
}

try fileManager.createDirectory(
    at: outputURL,
    withIntermediateDirectories: true,
    attributes: nil
)

for source in sources {
    guard fileManager.fileExists(atPath: source.path) else {
        fputs("MacDashboard: missing system icon source at \(source.path)\n", stderr)
        exit(1)
    }

    let image: NSImage?
    if source.usesWorkspaceRendering {
        image = NSWorkspace.shared.icon(forFile: source.path)
    } else {
        image = NSImage(contentsOfFile: source.path)
    }

    guard let image else {
        fputs("MacDashboard: could not render \(source.name) from macOS.\n", stderr)
        exit(1)
    }

    try render(image, to: outputURL.appendingPathComponent("\(source.name).png"))
}

print("MacDashboard: installed native macOS icons in \(outputPath).")
