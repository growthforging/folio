use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Doc {
    path: String,
    name: String,
    kind: String, // "markdown" | "json" | "text"
    content: String,
    error: Option<String>,
}

fn kind_for(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".mdx")
        || lower.ends_with(".mdown")
    {
        "markdown"
    } else if lower.ends_with(".json") || lower.ends_with(".jsonc") || lower.ends_with(".geojson") {
        "json"
    } else {
        "text"
    }
}

#[tauri::command]
fn read_docs(paths: Vec<String>) -> Vec<Doc> {
    paths
        .into_iter()
        .map(|p| {
            let name = Path::new(&p)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());
            let kind = kind_for(&p).to_string();
            match std::fs::read_to_string(&p) {
                Ok(content) => Doc { path: p, name, kind, content, error: None },
                Err(e) => Doc {
                    path: p,
                    name,
                    kind,
                    content: String::new(),
                    error: Some(format!("Couldn't read file: {e}")),
                },
            }
        })
        .collect()
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Couldn't save: {e}"))
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Files passed to the app at launch (double-click while Folio wasn't running)
/// are buffered here; the frontend drains them once it has mounted.
#[derive(Default)]
struct Pending(Mutex<Vec<String>>);

#[tauri::command]
fn take_pending(state: tauri::State<Pending>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Pending::default())
        .invoke_handler(tauri::generate_handler![
            read_docs,
            write_file,
            reveal_in_finder,
            take_pending
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS sends this when a file is opened via "Open With" / double-click.
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    if let Some(state) = app.try_state::<Pending>() {
                        state.0.lock().unwrap().extend(paths.clone());
                    }
                    let _ = app.emit("open-files", paths);
                }
            }
        });
}
