// The stable launcher owns a shared lease for the full native-host lifetime.
// Activation takes the exclusive lease, covering all windows and all engines.
use super::*;
use fs2::FileExt;
use std::fs::{File, OpenOptions};

fn executable() -> PathBuf {
    std::env::current_exe().expect("executable path")
}
fn suffix(name: &str) -> String {
    format!("{name}{}", std::env::consts::EXE_SUFFIX)
}
fn node(payload: &Path) -> PathBuf {
    payload.join(if cfg!(windows) {
        "runtime/node/node.exe"
    } else {
        "runtime/node/bin/node"
    })
}
fn lock(root: &Path, name: &str) -> io::Result<File> {
    fs::create_dir_all(root.join("updates"))?;
    OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(root.join("updates").join(name))
}
pub fn managed_root() -> Option<PathBuf> {
    let exe = executable();
    let versions = exe.parent()?.parent()?;
    (versions.file_name()? == "versions").then(|| versions.parent().unwrap().to_path_buf())
}
fn read_json(file: &Path) -> BridgeResult<Value> {
    serde_json::from_slice(&fs::read(file).map_err(io_error)?)
        .map_err(|_| BridgeError::new("UPDATE_STATE_INVALID"))
}
fn write_json(file: &Path, value: &Value) -> BridgeResult<()> {
    let temporary = file.with_extension(format!("{}.tmp", Uuid::new_v4()));
    fs::write(&temporary, serde_json::to_vec(value).unwrap()).map_err(io_error)?;
    let result = fs::rename(&temporary, file).map_err(io_error);
    let _ = fs::remove_file(temporary);
    result
}
fn version(value: &str) -> bool {
    let parts: Vec<_> = value.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.len() <= 8 && p.bytes().all(|b| b.is_ascii_digit()))
}
fn payload(root: &Path, active: &Value, field: &str) -> BridgeResult<PathBuf> {
    let value = active[field].as_str().unwrap_or("");
    let name = value.strip_prefix("versions/").unwrap_or("");
    if name.is_empty()
        || name.starts_with('.')
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
    {
        return Err(BridgeError::new("UPDATE_STATE_INVALID"));
    }
    Ok(root.join("versions").join(name))
}
fn updater(source: &Path, action: &str, root: &Path) -> Command {
    let mut command = Command::new(node(source));
    command
        .arg(source.join("runtime/updater.cjs"))
        .arg(action)
        .arg(root)
        .arg(source);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
}
pub fn status() -> BridgeResult<Value> {
    let root = managed_root().ok_or_else(|| BridgeError::new("UPDATE_INSTALLER_REQUIRED"))?;
    let mut state = read_json(&root.join("updates/status.json")).unwrap_or(json!({"phase":"idle"}));
    if !state.is_object() {
        state = json!({"phase":"error"});
    }
    if matches!(
        state["phase"].as_str(),
        Some("checking" | "downloading" | "waiting_idle" | "applying")
    ) {
        let worker = lock(&root, "worker.lock").map_err(io_error)?;
        if FileExt::try_lock_exclusive(&worker).is_ok() {
            state["phase"] = json!("error");
            state["error"] = json!("UPDATE_INTERRUPTED");
            write_json(&root.join("updates/status.json"), &state)?;
        }
    }
    state["enabled"] = json!(enabled(&root));
    state["version"] = json!(env!("CARGO_PKG_VERSION"));
    Ok(state)
}
fn enabled(root: &Path) -> bool {
    // Corrupt preferences must not accidentally enable downloads.
    match read_json(&root.join("updates/settings.json")) {
        Ok(value) => value["enabled"].as_bool().unwrap_or(false),
        Err(_) => !root.join("updates/settings.json").exists(),
    }
}
pub fn configure(params: &Value) -> BridgeResult<Value> {
    let root = managed_root().ok_or_else(|| BridgeError::new("UPDATE_INSTALLER_REQUIRED"))?;
    let value = params["enabled"]
        .as_bool()
        .ok_or_else(|| BridgeError::new("FIELD_REQUIRED"))?;
    fs::create_dir_all(root.join("updates")).map_err(io_error)?;
    write_json(
        &root.join("updates/settings.json"),
        &json!({"enabled":value}),
    )?;
    status()
}
pub fn check(params: &Value) -> BridgeResult<Value> {
    let root = managed_root().ok_or_else(|| BridgeError::new("UPDATE_INSTALLER_REQUIRED"))?;
    let target = params["extensionVersion"]
        .as_str()
        .filter(|s| version(s))
        .ok_or_else(|| BridgeError::new("FIELD_INVALID"))?;
    if !enabled(&root) {
        return status();
    }
    let mut command = Command::new(executable());
    command.args([
        "--update-worker",
        target,
        if params["force"] == true {
            "force"
        } else {
            "auto"
        },
    ]);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000 | 0x00000200); // no console, independent process group
    }
    // The worker retains its own OS lock and process; no service-worker timer owns it.
    command.spawn().map_err(io_error)?;
    status()
}
fn launcher(args: &[String]) -> BridgeResult<i32> {
    let exe = executable();
    let directory = exe
        .parent()
        .ok_or_else(|| BridgeError::new("PATH_INVALID"))?;
    let root = if directory.file_name().is_some_and(|name| name == "launcher") {
        directory.parent().unwrap().to_path_buf()
    } else {
        // System Linux packages are read-only seeds. Initialize the current
        // user's managed installation using the seed's private Node.
        let output = Command::new(node(directory))
            .arg(directory.join("setup.cjs"))
            .arg("bootstrap")
            .arg(directory)
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .map_err(io_error)?;
        if !output.status.success() {
            return Err(BridgeError::new("UPDATE_BOOTSTRAP_FAILED"));
        }
        PathBuf::from(String::from_utf8_lossy(&output.stdout).trim())
    };
    let lease = lock(&root, "activity.lock").map_err(io_error)?;
    FileExt::lock_shared(&lease).map_err(io_error)?;
    let mut active = read_json(&root.join("active.json"))?;
    if active["probation"] == true {
        FileExt::unlock(&lease).map_err(io_error)?;
        FileExt::lock_exclusive(&lease).map_err(io_error)?;
        active = read_json(&root.join("active.json"))?;
        if active["probation"] == true {
            // An interrupted activation has never been acknowledged as healthy.
            let previous = payload(&root, &active, "previous")?;
            if !updater(&previous, "recover", &root)
                .status()
                .map_err(io_error)?
                .success()
            {
                return Err(BridgeError::new("UPDATE_ROLLBACK_FAILED"));
            }
        }
        FileExt::unlock(&lease).map_err(io_error)?;
        FileExt::lock_shared(&lease).map_err(io_error)?;
        active = read_json(&root.join("active.json"))?;
    }
    let current = payload(&root, &active, "current")?;
    let result = if args.first().is_some_and(|arg| arg == "--uninstall") {
        Command::new(node(&current))
            .arg(current.join("setup.cjs"))
            .arg("uninstall")
            .status()
    } else {
        Command::new(current.join(suffix("webagentmate-bridge")))
            .args(args)
            .status()
    }
    .map_err(io_error)?;
    Ok(result.code().unwrap_or(1))
}
fn internal(args: &[String]) -> BridgeResult<i32> {
    if args[0] == "--health-check" {
        runtime::health_check()?;
        println!(
            "{}",
            json!({"version":env!("CARGO_PKG_VERSION"),"protocolVersion":PROTOCOL_VERSION,"runtimeV2":true})
        );
        return Ok(0);
    }
    let root = managed_root().ok_or_else(|| BridgeError::new("UPDATE_INSTALLER_REQUIRED"))?;
    let source = executable().parent().unwrap().to_path_buf();
    if args[0] == "--update-worker" {
        let lease = lock(&root, "worker.lock").map_err(io_error)?;
        if FileExt::try_lock_exclusive(&lease).is_err() {
            return Ok(0);
        }
        let target = args
            .get(1)
            .filter(|s| version(s))
            .ok_or_else(|| BridgeError::new("FIELD_INVALID"))?;
        let result = updater(&source, "check", &root)
            .arg(target)
            .arg(args.get(2).map(String::as_str).unwrap_or("auto"))
            .status()
            .map_err(io_error)?;
        return Ok(result.code().unwrap_or(1));
    }
    if args[0] == "--apply-update" {
        let lease = lock(&root, "activity.lock").map_err(io_error)?;
        FileExt::lock_exclusive(&lease).map_err(io_error)?;
        let result = updater(&source, "apply", &root)
            .args(&args[1..])
            .status()
            .map_err(io_error)?;
        return Ok(result.code().unwrap_or(1));
    }
    Err(BridgeError::new("METHOD_UNKNOWN"))
}
pub fn entry() -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let is_launcher = executable()
        .file_stem()
        .is_some_and(|name| name == "webagentmate-launcher");
    let result = if is_launcher {
        launcher(&args)
    } else if args.first().is_some_and(|arg| arg.starts_with("--")) {
        internal(&args)
    } else {
        return None;
    };
    Some(match result {
        Ok(code) => code,
        Err(error) => {
            eprintln!("WebAgentMate: {}", error.code);
            1
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn active_paths_cannot_escape_versions() {
        for name in [
            "../elsewhere",
            "versions/..",
            "versions/a/b",
            "versions/C:\\x",
            "versions/.hidden",
        ] {
            assert!(payload(Path::new("/tmp"), &json!({"current":name}), "current").is_err());
        }
        assert!(payload(
            Path::new("/tmp"),
            &json!({"current":"versions/0.6.0-abcd"}),
            "current"
        )
        .is_ok());
    }
}
