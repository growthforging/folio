use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Doc {
    path: String,
    name: String,
    kind: String, // "markdown" | "json" | "csv" | "text"
    content: String,
    error: Option<String>,
    modified: Option<u64>,
    size: Option<u64>,
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
    } else if lower.ends_with(".csv") || lower.ends_with(".tsv") {
        "csv"
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
            let meta = std::fs::metadata(&p).ok();
            let modified = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);
            let size = meta.as_ref().map(|m| m.len());
            match std::fs::read_to_string(&p) {
                Ok(content) => Doc { path: p, name, kind, content, error: None, modified, size },
                Err(e) => Doc {
                    path: p,
                    name,
                    kind,
                    content: String::new(),
                    error: Some(format!("Couldn't read file: {e}")),
                    modified,
                    size,
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

fn item(app: &AppHandle, id: &str, label: &str, accel: Option<&str>) -> tauri::Result<MenuItem<tauri::Wry>> {
    MenuItem::with_id(app, id, label, true, accel)
}

/// A real macOS menu bar. Every custom item emits a `menu` event with its id;
/// the frontend routes those through the same command dispatcher as the UI.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let about = AboutMetadata {
        name: Some("Folio".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        copyright: Some("MIT License".into()),
        ..Default::default()
    };
    let app_menu = Submenu::with_items(
        app,
        "Folio",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Folio"), Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &item(app, "new-md", "New Markdown", Some("CmdOrCtrl+N"))?,
            &item(app, "new-json", "New JSON", Some("CmdOrCtrl+Shift+N"))?,
            &item(app, "open", "Open…", Some("CmdOrCtrl+O"))?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "close-doc", "Close", Some("CmdOrCtrl+W"))?,
            &item(app, "save", "Save", Some("CmdOrCtrl+S"))?,
            &item(app, "save-as", "Save As…", Some("CmdOrCtrl+Shift+S"))?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "reveal", "Reveal in Finder", Some("CmdOrCtrl+Alt+R"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "find", "Find…", Some("CmdOrCtrl+F"))?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "edit", "Edit Document", Some("CmdOrCtrl+E"))?,
            &item(app, "done", "Finish Editing", Some("CmdOrCtrl+Shift+E"))?,
        ],
    )?;
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &item(app, "palette", "Command Palette…", Some("CmdOrCtrl+K"))?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "sidebar", "Toggle Sidebar", Some("CmdOrCtrl+\\"))?,
            &item(app, "outline", "Toggle Outline", Some("CmdOrCtrl+Shift+O"))?,
            &item(app, "md-toggle", "Toggle Rich / Source Editing", Some("CmdOrCtrl+Shift+M"))?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "zoom-in", "Zoom In", Some("CmdOrCtrl+="))?,
            &item(app, "zoom-out", "Zoom Out", Some("CmdOrCtrl+-"))?,
            &item(app, "zoom-reset", "Actual Size", Some("CmdOrCtrl+0"))?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "theme-light", "Light Appearance", None)?,
            &item(app, "theme-dark", "Dark Appearance", None)?,
            &item(app, "theme-system", "Match System Appearance", None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::bring_all_to_front(app, None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Pending::default())
        .menu(build_menu)
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().0.clone());
        })
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
