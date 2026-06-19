// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_startup_file() -> Option<serde_json::Value> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let path = args[1].clone();
        if let Ok(content) = std::fs::read_to_string(&path) {
            return Some(serde_json::json!({
                "path": path,
                "content": content
            }));
        }
    }
    None
}

#[tauri::command]
fn save_file_direct(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_startup_file,
            save_file_direct
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
