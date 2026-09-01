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
    let path_buf = std::path::PathBuf::from(&path);
    let mut temp_path = path_buf.clone();
    
    // 重複を避けるため、現在時刻（マイクロ秒）を使って一時ファイル名を生成
    let time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_micros())
        .unwrap_or(0);
    
    let file_name = path_buf.file_name().unwrap_or_default().to_string_lossy();
    let temp_name = format!("{}.{}.tmp", file_name, time);
    temp_path.set_file_name(temp_name);

    // 1. まず一時ファイルに書き込む（ここで失敗しても元のファイルは無事）
    std::fs::write(&temp_path, &content).map_err(|e| e.to_string())?;

    // 2. 一時ファイルを本来のファイル名にリネーム（OSレベルでアトミックに置換される）
    match std::fs::rename(&temp_path, &path_buf) {
        Ok(_) => Ok(()),
        Err(e) => {
            // リネームに失敗した場合はゴミを残さないよう一時ファイルを削除
            let _ = std::fs::remove_file(&temp_path);
            Err(format!("アトミック保存に失敗しました: {}", e))
        }
    }
}

#[tauri::command]
async fn show_main_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
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
            save_file_direct,
            show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
