use tauri::State;
use std::sync::Mutex;
use crate::advisor::model::Recommendation;

#[derive(Default)]
pub struct AdvisorState {
    pub recommendations: Vec<Recommendation>,
}

#[tauri::command]
pub fn get_recommendations(
    _snapshot_id: i64,
    advisor: State<Mutex<AdvisorState>>,
) -> Result<Vec<Recommendation>, String> {
    let advisor = advisor.lock().unwrap();
    Ok(advisor.recommendations.clone())
}