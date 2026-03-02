mod commands;
mod models;
mod tunnel_manager;

use std::fs;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};
use tunnel_manager::TunnelManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let start_all = MenuItemBuilder::with_id("start_all", "Start All Tunnels").build(app)?;
            let stop_all = MenuItemBuilder::with_id("stop_all", "Stop All Tunnels").build(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&sep1)
                .item(&start_all)
                .item(&stop_all)
                .item(&sep2)
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Tunnelo")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "start_all" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                // Load tunnels from disk and start all
                                let path = match app.path().app_data_dir() {
                                    Ok(p) => p.join("tunnels.json"),
                                    Err(_) => return,
                                };
                                if !path.exists() {
                                    return;
                                }
                                let json = match fs::read_to_string(&path) {
                                    Ok(j) => j,
                                    Err(_) => return,
                                };
                                let configs: Vec<models::TunnelConfig> =
                                    match serde_json::from_str(&json) {
                                        Ok(c) => c,
                                        Err(_) => return,
                                    };
                                let manager = app.state::<TunnelManager>();
                                for config in configs {
                                    let _ = manager.start_tunnel(app.clone(), config).await;
                                }
                            });
                        }
                        "stop_all" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let manager = app.state::<TunnelManager>();
                                manager.stop_all(&app).await;
                            });
                        }
                        "quit" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let manager = app.state::<TunnelManager>();
                                manager.stop_all(&app).await;
                                app.exit(0);
                            });
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Auto-start tunnels with auto_start=true
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                log::info!("Auto-start: checking for tunnels to start...");
                let path = match app_handle.path().app_data_dir() {
                    Ok(p) => p.join("tunnels.json"),
                    Err(e) => {
                        log::error!("Auto-start: failed to get app data dir: {}", e);
                        return;
                    }
                };
                log::info!("Auto-start: reading {:?}", path);
                if !path.exists() {
                    log::info!("Auto-start: tunnels.json not found, skipping");
                    return;
                }
                let json = match fs::read_to_string(&path) {
                    Ok(j) => j,
                    Err(e) => {
                        log::error!("Auto-start: failed to read file: {}", e);
                        return;
                    }
                };
                let configs: Vec<models::TunnelConfig> = match serde_json::from_str(&json) {
                    Ok(c) => c,
                    Err(e) => {
                        log::error!("Auto-start: failed to parse JSON: {}", e);
                        return;
                    }
                };
                let auto_starts: Vec<_> = configs
                    .into_iter()
                    .filter(|c| c.auto_start == Some(true))
                    .collect();
                log::info!("Auto-start: found {} tunnel(s) to start", auto_starts.len());
                if auto_starts.is_empty() {
                    return;
                }
                let manager = app_handle.state::<TunnelManager>();
                for config in auto_starts {
                    let name = config.name.clone();
                    match manager.start_tunnel(app_handle.clone(), config).await {
                        Ok(id) => log::info!("Auto-started tunnel '{}' with id {}", name, id),
                        Err(e) => log::error!("Failed to auto-start tunnel '{}': {}", name, e),
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .manage(TunnelManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::start_tunnel,
            commands::stop_tunnel,
            commands::get_tunnel_status,
            commands::list_active_tunnels,
            commands::test_connection,
            commands::save_tunnels,
            commands::load_tunnels,
            commands::stop_all_tunnels,
            commands::start_all_tunnels,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
