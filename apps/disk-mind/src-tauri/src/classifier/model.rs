use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub kind: String,
    pub confidence: f32,
    pub attributes: std::collections::HashMap<String, String>,
}
