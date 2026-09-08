# Linux packaging

The release workflow builds a Linux x64 ZIP containing the Bridge, Node runtime,
license notices, and installer/uninstaller scripts. The installer registers a
Native Messaging manifest for Chrome, Chromium, and Edge with one exact extension
origin, using user-level directories. Node.js 20+ is installed separately.
