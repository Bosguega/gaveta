use tauri::State;
use crate::db::{self, migrations};
use crate::DbState;

pub fn with_connection<F, T>(state: &DbState, f: F) -> Result<T, String>
where
    F: FnOnce(&rusqlite::Connection) -> Result<T, String>,
{
    let mut guard = state.0.lock().unwrap();
    if guard.is_none() {
        let db_path = std::env::var("DISKMIND_DB_PATH").unwrap_or_else(|_| {
            dirs::data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("diskmind")
                .join("scans.db")
                .to_string_lossy()
                .to_string()
        });
        let conn = db::open(std::path::PathBuf::from(db_path)).map_err(|e| e.to_string())?;
        migrations::run(&conn).map_err(|e| e.to_string())?;
        *guard = Some(conn);
    }
    f(guard.as_ref().unwrap())
}

#[tauri::command]
pub fn open_db(path: String, state: State<DbState>) -> Result<(), String> {
    let conn = db::open(std::path::PathBuf::from(path)).map_err(|e| e.to_string())?;
    migrations::run(&conn).map_err(|e| e.to_string())?;
    let mut guard = state.0.lock().unwrap();
    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
pub fn get_snapshot(snapshot_id: i64, state: State<DbState>) -> Result<serde_json::Value, String> {
    with_connection(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, created_at, root FROM snapshots WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let snapshot = stmt
            .query_row([snapshot_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "createdAt": row.get::<_, String>(1)?,
                    "root": row.get::<_, String>(2)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        Ok(snapshot)
    })
}

#[tauri::command]
pub fn get_snapshot_tree(snapshot_id: i64, state: State<DbState>) -> Result<serde_json::Value, String> {
    with_connection(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, parent_id, name, size, file_count, depth FROM dirs WHERE snapshot_id = ? ORDER BY depth ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([snapshot_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "parentId": row.get::<_, Option<i64>>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "size": row.get::<_, i64>(3)?,
                    "fileCount": row.get::<_, i64>(4)?,
                    "depth": row.get::<_, i64>(5)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for item in rows {
            out.push(item.map_err(|e| e.to_string())?);
        }
        Ok(serde_json::json!({ "dirs": out }))
    })
}

#[tauri::command]
pub fn export_snapshot_report(snapshot_id: i64, path: String, state: State<DbState>) -> Result<(), String> {
    with_connection(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, parent_id, name, size, file_count, depth FROM dirs WHERE snapshot_id = ? ORDER BY depth ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([snapshot_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "parentId": row.get::<_, Option<i64>>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "size": row.get::<_, i64>(3)?,
                    "fileCount": row.get::<_, i64>(4)?,
                    "depth": row.get::<_, i64>(5)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for item in rows {
            out.push(item.map_err(|e| e.to_string())?);
        }
        let report = serde_json::to_string_pretty(&out).unwrap_or_default();
        std::fs::write(&path, report).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn compare_snapshots(snapshot_a: i64, snapshot_b: i64, state: State<DbState>) -> Result<serde_json::Value, String> {
    with_connection(&state, |conn| {
        let mut stmt = conn
            .prepare("
                SELECT 
                    a.name as name_a,
                    b.name as name_b,
                    a.size as size_a,
                    b.size as size_b,
                    COALESCE(a.size, 0) - COALESCE(b.size, 0) as diff
                FROM dirs a
                FULL OUTER JOIN dirs b ON a.snapshot_id = ? AND b.snapshot_id = ? AND a.parent_id = b.parent_id AND a.name = b.name
                WHERE a.depth = 0 OR b.depth = 0
                ORDER BY diff DESC
            ")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([snapshot_a, snapshot_b], |row| {
                Ok(serde_json::json!({
                    "name": row.get::<_, String>(0).or_else(|_| row.get::<_, String>(1)).unwrap_or_default(),
                    "sizeA": row.get::<_, Option<i64>>(2).unwrap_or(Some(0)).unwrap_or(0),
                    "sizeB": row.get::<_, Option<i64>>(3).unwrap_or(Some(0)).unwrap_or(0),
                    "diff": row.get::<_, i64>(4)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for item in rows {
            out.push(item.map_err(|e| e.to_string())?);
        }
        Ok(serde_json::json!({ "items": out }))
    })
}
#[tauri::command]
pub fn list_snapshots(state: State<DbState>) -> Result<Vec<serde_json::Value>, String> {
    with_connection(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, created_at, root FROM snapshots ORDER BY id DESC")
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "createdAt": row.get::<_, String>(1)?,
                    "root": row.get::<_, String>(2)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for item in iter {
            out.push(item.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}
