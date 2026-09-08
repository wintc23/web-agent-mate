# Contributing

Issues and pull requests are welcome. Start with the setup instructions in [README.md](README.md) or [简体中文](README.zh-CN.md). Development requires Node.js 20+ and stable Rust with Cargo; CI uses Node.js 22.

Fork the repository, create a branch for your change, and keep each pull request focused on one problem. Describe the behavior before and after the change, include the checks you ran, and attach screenshots for visible interface changes. For a larger feature, open an issue first to discuss its scope.

Before submitting a change, run:

```bash
npm ci
npm run build
npm test
npm run build:runtime
cargo fmt --manifest-path bridge/Cargo.toml -- --check
cargo test --manifest-path bridge/Cargo.toml
```

Never commit credentials, user conversations, generated databases, signing certificates, or store-account material.

Automated tests use synthetic data and do not require provider accounts. Live smoke checks in the README use your local agent authentication and may make paid model requests; they are optional for ordinary contributions.

Keep the English and Chinese READMEs aligned when installation or user-facing behavior changes. Update `PRIVACY.md` and `CHROMEWEBSTORE.md` when permissions or data handling change. Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

By contributing, you agree to license your contributions under the project's [MIT License](LICENSE).
