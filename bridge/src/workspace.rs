use super::*;

// Invoked only by the extension's directory picker. File contents are never read.
pub fn list(params: &Value) -> BridgeResult<Value> {
    let raw = params.get("path").and_then(Value::as_str).unwrap_or("");
    if raw.len() > 8192 || raw.contains('\0') {
        return Err(BridgeError::new("WORKSPACE_PATH_INVALID"));
    }
    let home = directories::BaseDirs::new()
        .ok_or_else(|| BridgeError::new("HOME_DIRECTORY_UNAVAILABLE"))?
        .home_dir()
        .to_path_buf();
    let requested = if raw.is_empty() || raw == "~" {
        home
    } else if let Some(rest) = raw.strip_prefix("~/") {
        home.join(rest)
    } else {
        PathBuf::from(raw)
    };
    if !requested.is_absolute() {
        return Err(BridgeError::new("WORKSPACE_PATH_INVALID"));
    }
    let path = requested.canonicalize().map_err(io_error)?;
    if !path.is_dir() {
        return Err(BridgeError::new("WORKSPACE_NOT_DIRECTORY"));
    }
    let mut folders = Vec::new();
    for entry in fs::read_dir(&path).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        if entry.path().is_dir() {
            folders.push((
                entry.file_name().to_string_lossy().into_owned(),
                entry.path(),
            ));
        }
    }
    folders.sort_by(|a, b| {
        a.0.to_lowercase()
            .cmp(&b.0.to_lowercase())
            .then(a.0.cmp(&b.0))
    });
    let offset = params
        .get("offset")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(usize::MAX as u64) as usize;
    let next = offset.saturating_add(200);
    let directories: Vec<Value> = folders
        .iter()
        .skip(offset)
        .take(200)
        .map(|(name, path)| json!({ "name": name, "path": path.to_string_lossy() }))
        .collect();
    Ok(
        json!({ "path": path.to_string_lossy(), "parent": path.parent().map(|p| p.to_string_lossy()),
        "directories": directories, "nextOffset": if next < folders.len() { Some(next) } else { None } }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn picker_only_lists_directories_and_rejects_invalid_paths() {
        let root = std::env::temp_dir().join(format!("wam-picker-{}", Uuid::new_v4()));
        fs::create_dir_all(root.join("Project with spaces")).unwrap();
        fs::write(root.join("file.txt"), "not a directory").unwrap();
        let result = list(&json!({ "path": root })).unwrap();
        assert_eq!(result["directories"].as_array().unwrap().len(), 1);
        assert_eq!(result["directories"][0]["name"], "Project with spaces");
        assert!(result["nextOffset"].is_null());
        assert!(list(&json!({ "path": root.join("file.txt") })).is_err());
        assert!(list(&json!({ "path": "relative/path" })).is_err());
        assert!(
            list(&json!({ "path": root, "offset": 200 })).unwrap()["directories"]
                .as_array()
                .unwrap()
                .is_empty()
        );
        fs::remove_dir_all(root).unwrap();
    }
}
