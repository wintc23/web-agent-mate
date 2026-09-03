# macOS packaging

Package the two Rust binaries as a universal app or as separate x64 and arm64
archives. The official package writes an exact `allowed_origins` entry using
the Chrome Web Store ID. Signing and notarization are optional for development
and expected for general-audience distribution.
