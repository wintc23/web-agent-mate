use super::*;
use std::io::{BufRead, BufReader};

fn bundle_path() -> Option<PathBuf> {
    let executable = std::env::current_exe().ok()?;
    let installed = executable.parent()?.join("runtime/agent.mjs");
    if installed.is_file() {
        return Some(installed);
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime-dist/agent.mjs");
    development.is_file().then_some(development)
}
fn node_path() -> Option<PathBuf> {
    let mut paths = Vec::new();
    // Release installers carry a private runtime; users do not install Node.
    if let Ok(executable) = std::env::current_exe() {
        if let Some(directory) = executable.parent() {
            paths.push(directory.join(if cfg!(windows) {
                "runtime/node/node.exe"
            } else {
                "runtime/node/bin/node"
            }));
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        paths.extend([home.join(".local/n/bin/node"), home.join(".local/bin/node")]);
    }
    if let Some(path) = find_executable("node") {
        paths.push(path);
    }
    paths.extend([
        PathBuf::from("/opt/homebrew/bin/node"),
        PathBuf::from("/usr/local/bin/node"),
    ]);
    paths.into_iter().find(|path| {
        if !path.is_file() {
            return false;
        }
        probe_cli(path)
            .ok()
            .and_then(|version| {
                version
                    .trim_start_matches('v')
                    .split('.')
                    .next()?
                    .parse::<u32>()
                    .ok()
            })
            .is_some_and(|major| major >= 20)
    })
}
pub fn available() -> bool {
    bundle_path().is_some() && node_path().is_some()
}

// One Native Messaging port owns one runtime. Its closure closes runtime stdin,
// which cancels pending approvals/model requests and terminates owned children.
pub fn serve(request: &Request, reader: &mut impl Read) -> BridgeResult<()> {
    let bundle = bundle_path().ok_or_else(|| BridgeError::new("RUNTIME_BUNDLE_MISSING"))?;
    let node = node_path().ok_or_else(|| BridgeError::new("NODE_20_REQUIRED"))?;
    let dirs = ProjectDirs::from("ai", "WebAgentMate", "WebAgentMate")
        .ok_or_else(|| BridgeError::new("DATA_DIRECTORY_UNAVAILABLE"))?;
    let workspace = dirs.data_local_dir().join("workspace");
    fs::create_dir_all(&workspace).map_err(io_error)?;
    set_private_directory_permissions(&workspace)?;
    let mut command = Command::new(&node);
    if let Some(directory) = node.parent() {
        let mut paths = vec![directory.to_path_buf()];
        paths.extend(std::env::split_paths(
            &std::env::var_os("PATH").unwrap_or_default(),
        ));
        if let Ok(path) = std::env::join_paths(paths) {
            command.env("PATH", path);
        }
    }
    command
        .arg(bundle)
        .env("WAM_WORKSPACE", &workspace)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    for (engine, key) in [("codex", "WAM_CODEX_PATH"), ("claude", "WAM_CLAUDE_PATH")] {
        if let Some(path) = find_executable(engine) {
            command.env(key, path);
        }
    }
    let mut child = command.spawn().map_err(io_error)?;
    let mut input = child
        .stdin
        .take()
        .ok_or_else(|| BridgeError::new("RUNTIME_START_FAILED"))?;
    let output = child
        .stdout
        .take()
        .ok_or_else(|| BridgeError::new("RUNTIME_START_FAILED"))?;
    let output_thread = thread::spawn(move || {
        let mut source = BufReader::new(output);
        let mut writer = io::stdout().lock();
        loop {
            let mut bytes = Vec::new();
            match source
                .by_ref()
                .take((MAX_MESSAGE_BYTES + 1) as u64)
                .read_until(b'\n', &mut bytes)
            {
                Ok(0) | Err(_) => break,
                Ok(_) if bytes.len() > MAX_MESSAGE_BYTES => break,
                _ => {}
            }
            if serde_json::from_slice::<Value>(&bytes).is_err() {
                break;
            }
            if writer
                .write_all(&(bytes.len() as u32).to_le_bytes())
                .is_err()
                || writer.write_all(&bytes).is_err()
                || writer.flush().is_err()
            {
                break;
            }
        }
    });
    let first = serde_json::to_string(&request.params)
        .map_err(|e| BridgeError::detail("MESSAGE_INVALID", e.to_string()))?;
    writeln!(input, "{first}").map_err(io_error)?;
    input.flush().map_err(io_error)?;
    loop {
        match read_request(reader) {
            Ok(Some(message))
                if message.protocol_version == PROTOCOL_VERSION
                    && message.method == "runtime.send" =>
            {
                let line = serde_json::to_string(&message.params)
                    .map_err(|e| BridgeError::detail("MESSAGE_INVALID", e.to_string()))?;
                if writeln!(input, "{line}").is_err() || input.flush().is_err() {
                    break;
                }
            }
            _ => break,
        }
    }
    drop(input);
    for _ in 0..30 {
        if child.try_wait().map_err(io_error)?.is_some() {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
    let _ = child.wait();
    let _ = output_thread.join();
    Ok(())
}
