const { resolve } = require("path");

module.exports = {
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(process.cwd(), "sidepanel.html"),
        background: resolve(process.cwd(), "src/background.ts")
      },
      output: {
        entryFileNames: function (chunk) {
          return chunk.name === "background"
            ? "background.js"
            : "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
};
