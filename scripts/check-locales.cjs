const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const expected = ["en", "zh_CN", "zh_TW", "pt_BR", "ja", "de"];
const baselinePath = path.join(root, "public", "_locales", "en", "messages.json");
const baseline = Object.keys(JSON.parse(fs.readFileSync(baselinePath, "utf8"))).sort();

for (const locale of expected) {
  const filename = path.join(root, "public", "_locales", locale, "messages.json");
  if (!fs.existsSync(filename)) throw new Error(`Missing Chrome locale: ${locale}`);
  const messages = JSON.parse(fs.readFileSync(filename, "utf8"));
  const keys = Object.keys(messages).sort();
  if (JSON.stringify(keys) !== JSON.stringify(baseline)) {
    throw new Error(`Chrome locale keys do not match English: ${locale}`);
  }
  for (const key of keys) {
    if (!messages[key] || typeof messages[key].message !== "string" || !messages[key].message.trim()) {
      throw new Error(`Invalid ${locale}.${key}`);
    }
  }
}

const runtimeSource = fs.readFileSync(path.join(root, "src", "locales.ts"), "utf8");
for (const locale of expected) {
  if (!runtimeSource.includes(locale)) throw new Error(`Runtime locale is not declared: ${locale}`);
}
console.log(`Locale check passed: ${expected.join(", ")}`);
