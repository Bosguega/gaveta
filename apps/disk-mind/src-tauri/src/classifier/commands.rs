use crate::classifier::model::Entity;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default)]
pub struct KnowledgePackState(pub Mutex<HashMap<String, Vec<String>>>);

#[tauri::command]
pub fn load_knowledge_pack(name: String, rules: Vec<String>, state: tauri::State<KnowledgePackState>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    guard.insert(name, rules);
    Ok(())
}

#[tauri::command]
pub fn list_knowledge_packs(state: tauri::State<KnowledgePackState>) -> Result<Vec<String>, String> {
    let guard = state.0.lock().unwrap();
    Ok(guard.keys().cloned().collect())
}

#[tauri::command]
pub fn get_entities(
    _snapshot_id: i64,
) -> Result<Vec<Entity>, String> {
    // Placeholder: in future, load raw entries from snapshot and classify
    Ok(Vec::new())
}
