# Contributing

Issues and pull requests are welcome. Before submitting a change, run:

```bash
npm ci
npm run build
cargo fmt --manifest-path bridge/Cargo.toml -- --check
cargo test --manifest-path bridge/Cargo.toml
```

Never commit credentials, user conversations, generated databases, signing certificates, or store-account material.
