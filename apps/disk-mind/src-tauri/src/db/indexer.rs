use crate::scanner::model::RawEntry;
use rusqlite::Connection;
use std::path::PathBuf;
use std::collections::HashMap;

pub fn index_snapshot(conn: &mut Connection, root: PathBuf, entries: &[RawEntry]) -> Result<i64, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO snapshots (created_at, root) VALUES (datetime('now'), ?)",
        [root.to_string_lossy().to_string()],
    )
    .map_err(|e| e.to_string())?;

    let snapshot_id = tx.last_insert_rowid();

    // Map to track directory paths to database IDs in memory
    let mut dir_ids: HashMap<PathBuf, i64> = HashMap::new();

    // Insert root directory entry
    let root_name = root.file_name().and_then(|n| n.to_str()).unwrap_or("root").to_string();
    tx.execute(
        "INSERT INTO dirs (snapshot_id, parent_id, name, size, file_count, depth)
         VALUES (?, NULL, ?, 0, 0, 0)",
        (snapshot_id, &root_name),
    )
    .map_err(|e| e.to_string())?;
    let root_id = tx.last_insert_rowid();
    dir_ids.insert(root.clone(), root_id);

    for entry in entries {
        // Skip root entry if it's in the list to avoid duplicate root insertion
        if entry.path == root {
            continue;
        }

        let path = &entry.path;
        let name = &entry.name;

        // Resolve parent_id using our in-memory map
        let parent_id = if let Some(parent) = path.parent() {
            if let Some(&pid) = dir_ids.get(parent) {
                pid
            } else {
                root_id // fallback to root
            }
        } else {
            root_id
        };

        if entry.path.is_dir() {
            tx.execute(
                "INSERT INTO dirs (snapshot_id, parent_id, name, size, file_count, depth)
                 VALUES (?, ?, ?, 0, 0, 0)",
                (snapshot_id, parent_id, name),
            )
            .map_err(|e| e.to_string())?;
            let dir_id = tx.last_insert_rowid();
            dir_ids.insert(entry.path.clone(), dir_id);
        } else {
            // For files, the dir_id is the parent folder's ID
            let dir_id = parent_id;

            tx.execute(
                "INSERT INTO files (snapshot_id, dir_id, name, ext, size, mtime, hash, symlink, hidden)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    snapshot_id,
                    dir_id,
                    name,
                    entry.extension.as_ref(),
                    entry.size as i64,
                    entry.modified,
                    Option::<String>::None,
                    entry.is_symlink as i32,
                    entry.is_hidden as i32,
                ),
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(snapshot_id)
}