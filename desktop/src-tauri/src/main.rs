// Innovative LTC — desktop shell. Loads the self-contained quoting page
// (bundled as index.html) in a native window. No custom commands: the page
// is pure HTML/JS and stores its data in the webview's own local storage.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Innovative LTC");
}
