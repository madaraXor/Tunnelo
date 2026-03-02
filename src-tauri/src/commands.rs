use std::fs;

use tauri::{AppHandle, Manager};

use crate::models::*;
use crate::tunnel_manager::TunnelManager;

fn tunnels_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_data.join("tunnels.json"))
}

#[tauri::command]
pub async fn start_tunnel(
    app: AppHandle,
    config: TunnelConfig,
) -> Result<String, String> {
    let manager = app.state::<TunnelManager>();
    manager.start_tunnel(app.clone(), config).await
}

#[tauri::command]
pub async fn stop_tunnel(app: AppHandle, id: String) -> Result<(), String> {
    let manager = app.state::<TunnelManager>();
    manager.stop_tunnel(&app, &id).await
}

#[tauri::command]
pub fn get_tunnel_status(app: AppHandle, id: String) -> Result<String, String> {
    let manager = app.state::<TunnelManager>();
    match manager.get_status(&id) {
        Some(status) => serde_json::to_string(&status).map_err(|e| e.to_string()),
        None => Err("Tunnel not found".to_string()),
    }
}

#[tauri::command]
pub fn list_active_tunnels(app: AppHandle) -> Result<Vec<TunnelInfo>, String> {
    let manager = app.state::<TunnelManager>();
    Ok(manager.list_active())
}

#[tauri::command]
pub async fn test_connection(
    app: AppHandle,
    config: TunnelConfig,
) -> Result<(), String> {
    let manager = app.state::<TunnelManager>();
    manager.test_connection(&config).await
}

#[tauri::command]
pub async fn stop_all_tunnels(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<TunnelManager>();
    manager.stop_all(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn start_all_tunnels(
    app: AppHandle,
    configs: Vec<TunnelConfig>,
) -> Result<Vec<String>, String> {
    let manager = app.state::<TunnelManager>();
    let mut ids = Vec::new();
    for config in configs {
        match manager.start_tunnel(app.clone(), config).await {
            Ok(id) => ids.push(id),
            Err(e) => log::error!("Failed to auto-start tunnel: {}", e),
        }
    }
    Ok(ids)
}

#[tauri::command]
pub fn save_tunnels(app: AppHandle, configs: Vec<TunnelConfig>) -> Result<(), String> {
    let path = tunnels_path(&app)?;
    let json = serde_json::to_string_pretty(&configs).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to write tunnels: {}", e))
}

#[tauri::command]
pub fn load_tunnels(app: AppHandle) -> Result<Vec<TunnelConfig>, String> {
    let path = tunnels_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("Failed to read tunnels: {}", e))?;
    serde_json::from_str(&json).map_err(|e| format!("Failed to parse tunnels: {}", e))
}
