use std::sync::Arc;

use dashmap::DashMap;
use russh::client;
use russh::keys::{self, *};
use russh::{ChannelMsg, Disconnect};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::models::*;

struct TunnelHandle {
    cancel: CancellationToken,
    config: TunnelConfig,
    status: TunnelStatus,
}

pub struct TunnelManager {
    tunnels: DashMap<String, TunnelHandle>,
}

struct SshHandler;

impl client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // TODO: Implement proper host key verification
        Ok(true)
    }
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: DashMap::new(),
        }
    }

    fn emit_status(&self, app: &AppHandle, id: &str, status: TunnelStatus) {
        if let Some(mut handle) = self.tunnels.get_mut(id) {
            handle.status = status.clone();
        }
        let _ = app.emit(
            "tunnel:status_changed",
            StatusChangedPayload {
                id: id.to_string(),
                status,
            },
        );
    }

    fn emit_log(&self, app: &AppHandle, id: &str, message: &str) {
        let _ = app.emit(
            "tunnel:log",
            LogPayload {
                id: id.to_string(),
                message: message.to_string(),
            },
        );
    }

    pub async fn start_tunnel(
        &self,
        app: AppHandle,
        config: TunnelConfig,
    ) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let cancel = CancellationToken::new();

        self.tunnels.insert(
            id.clone(),
            TunnelHandle {
                cancel: cancel.clone(),
                config: config.clone(),
                status: TunnelStatus::Connecting,
            },
        );

        self.emit_status(&app, &id, TunnelStatus::Connecting);
        self.emit_log(&app, &id, "Connecting to SSH server...");

        let ssh_config = Arc::new(client::Config::default());
        let addr = format!("{}:{}", config.ssh_host, config.ssh_port);

        let mut session = client::connect(ssh_config, &addr, SshHandler)
            .await
            .map_err(|e| {
                let msg = format!("Connection failed: {}", e);
                self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
                self.emit_log(&app, &id, &msg);
                msg
            })?;

        // Authenticate
        self.emit_log(&app, &id, "Authenticating...");
        let auth_success = match config.auth_method {
            AuthMethod::Password => {
                let password = config.password.as_deref().unwrap_or("");
                session
                    .authenticate_password(&config.ssh_username, password)
                    .await
                    .map_err(|e| {
                        let msg = format!("Auth error: {}", e);
                        self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
                        msg
                    })?
                    .success()
            }
            AuthMethod::PrivateKey => {
                let key_path = config
                    .private_key_path
                    .as_deref()
                    .ok_or_else(|| "No private key path specified".to_string())?;
                let private_key = keys::load_secret_key(key_path, None).map_err(|e| {
                    let msg = format!("Failed to load private key: {}", e);
                    self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
                    msg
                })?;

                let best_hash = session
                    .best_supported_rsa_hash()
                    .await
                    .map_err(|e| format!("Hash negotiation error: {}", e))?
                    .flatten();

                let key_with_algo =
                    PrivateKeyWithHashAlg::new(Arc::new(private_key), best_hash);

                session
                    .authenticate_publickey(&config.ssh_username, key_with_algo)
                    .await
                    .map_err(|e| {
                        let msg = format!("Auth error: {}", e);
                        self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
                        msg
                    })?
                    .success()
            }
        };

        if !auth_success {
            let msg = "Authentication failed".to_string();
            self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
            self.emit_log(&app, &id, &msg);
            self.tunnels.remove(&id);
            return Err(msg);
        }

        self.emit_log(&app, &id, "Authentication successful.");
        self.emit_status(&app, &id, TunnelStatus::Active);

        match config.forwarding_direction {
            ForwardingDirection::Local => {
                self.start_local_forward(app.clone(), id.clone(), session, config.clone(), cancel)
                    .await?;
            }
            ForwardingDirection::Remote => {
                self.start_remote_forward(app.clone(), id.clone(), session, config.clone(), cancel)
                    .await?;
            }
        }

        let _ = app.emit(
            "tunnel:started",
            TunnelStartedPayload {
                id: id.clone(),
                config,
            },
        );

        Ok(id)
    }

    async fn start_local_forward(
        &self,
        app: AppHandle,
        id: String,
        session: client::Handle<SshHandler>,
        config: TunnelConfig,
        cancel: CancellationToken,
    ) -> Result<(), String> {
        let bind_addr = format!("127.0.0.1:{}", config.local_port);
        let listener = TcpListener::bind(&bind_addr).await.map_err(|e| {
            let msg = format!("Failed to bind local port {}: {}", config.local_port, e);
            self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
            self.emit_log(&app, &id, &msg);
            msg
        })?;

        self.emit_log(
            &app,
            &id,
            &format!(
                "Local forward: 127.0.0.1:{} -> {}:{}",
                config.local_port, config.remote_host, config.remote_port
            ),
        );

        let remote_host = config.remote_host.clone();
        let remote_port = config.remote_port as u32;
        let local_port = config.local_port as u32;
        let app_clone = app.clone();
        let id_clone = id.clone();
        // Wrap session in Arc so it can be shared across connection tasks
        let session = Arc::new(session);

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel.cancelled() => {
                        break;
                    }
                    result = listener.accept() => {
                        match result {
                            Ok((mut tcp_stream, peer_addr)) => {
                                let _ = app_clone.emit("tunnel:log", LogPayload {
                                    id: id_clone.clone(),
                                    message: format!("New connection from {}", peer_addr),
                                });

                                let session = Arc::clone(&session);
                                let remote_host = remote_host.clone();
                                let cancel = cancel.clone();

                                tokio::spawn(async move {
                                    let mut channel = match session.channel_open_direct_tcpip(
                                        remote_host,
                                        remote_port,
                                        "127.0.0.1",
                                        local_port,
                                    ).await {
                                        Ok(ch) => ch,
                                        Err(_) => return,
                                    };

                                    let mut buf = vec![0u8; 65536];
                                    let mut stream_closed = false;

                                    loop {
                                        tokio::select! {
                                            _ = cancel.cancelled() => break,
                                            r = tcp_stream.read(&mut buf), if !stream_closed => {
                                                match r {
                                                    Ok(0) => {
                                                        stream_closed = true;
                                                        let _ = channel.eof().await;
                                                    }
                                                    Ok(n) => {
                                                        if channel.data(&buf[..n]).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                    Err(_) => break,
                                                }
                                            }
                                            msg = channel.wait() => {
                                                match msg {
                                                    Some(ChannelMsg::Data { ref data }) => {
                                                        if tcp_stream.write_all(data).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                    Some(ChannelMsg::Eof) => {
                                                        if !stream_closed {
                                                            let _ = channel.eof().await;
                                                        }
                                                        break;
                                                    }
                                                    None => break,
                                                    _ => {}
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                            Err(_) => break,
                        }
                    }
                }
            }
        });

        Ok(())
    }

    async fn start_remote_forward(
        &self,
        app: AppHandle,
        id: String,
        mut session: client::Handle<SshHandler>,
        config: TunnelConfig,
        cancel: CancellationToken,
    ) -> Result<(), String> {
        let result = session
            .tcpip_forward("0.0.0.0", config.remote_port as u32)
            .await
            .map_err(|e| {
                let msg = format!("Failed to request remote forward: {}", e);
                self.emit_status(&app, &id, TunnelStatus::Error(msg.clone()));
                self.emit_log(&app, &id, &msg);
                msg
            })?;

        self.emit_log(
            &app,
            &id,
            &format!(
                "Remote forward: remote:{} -> 127.0.0.1:{} (bound to port {})",
                config.remote_port, config.local_port, result
            ),
        );

        let local_port = config.local_port;
        let app_clone = app.clone();
        let id_clone = id.clone();

        tokio::spawn(async move {
            cancel.cancelled().await;
            let _ = app_clone.emit(
                "tunnel:log",
                LogPayload {
                    id: id_clone,
                    message: "Remote forward cancelled".to_string(),
                },
            );
            let _ = session
                .cancel_tcpip_forward("0.0.0.0", local_port as u32)
                .await;
        });

        Ok(())
    }

    pub async fn stop_tunnel(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        if let Some((_, handle)) = self.tunnels.remove(id) {
            handle.cancel.cancel();
            self.emit_log(app, id, "Tunnel stopped.");
            let _ = app.emit(
                "tunnel:status_changed",
                StatusChangedPayload {
                    id: id.to_string(),
                    status: TunnelStatus::Stopped,
                },
            );
            Ok(())
        } else {
            Err("Tunnel not found".to_string())
        }
    }

    pub async fn stop_all(&self, app: &AppHandle) {
        let ids: Vec<String> = self.tunnels.iter().map(|e| e.key().clone()).collect();
        for id in ids {
            let _ = self.stop_tunnel(app, &id).await;
        }
    }

    pub fn get_status(&self, id: &str) -> Option<TunnelStatus> {
        self.tunnels.get(id).map(|h| h.status.clone())
    }

    pub fn list_active(&self) -> Vec<TunnelInfo> {
        self.tunnels
            .iter()
            .map(|entry| TunnelInfo {
                id: entry.key().clone(),
                config: entry.value().config.clone(),
                status: entry.value().status.clone(),
            })
            .collect()
    }

    pub async fn test_connection(&self, config: &TunnelConfig) -> Result<(), String> {
        let ssh_config = Arc::new(client::Config::default());
        let addr = format!("{}:{}", config.ssh_host, config.ssh_port);

        let mut session = client::connect(ssh_config, &addr, SshHandler)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        let auth_success = match config.auth_method {
            AuthMethod::Password => {
                let password = config.password.as_deref().unwrap_or("");
                session
                    .authenticate_password(&config.ssh_username, password)
                    .await
                    .map_err(|e| format!("Auth error: {}", e))?
                    .success()
            }
            AuthMethod::PrivateKey => {
                let key_path = config
                    .private_key_path
                    .as_deref()
                    .ok_or("No private key path")?;
                let private_key = keys::load_secret_key(key_path, None)
                    .map_err(|e| format!("Failed to load key: {}", e))?;

                let best_hash = session
                    .best_supported_rsa_hash()
                    .await
                    .map_err(|e| format!("Hash error: {}", e))?
                    .flatten();

                let key_with_algo =
                    PrivateKeyWithHashAlg::new(Arc::new(private_key), best_hash);

                session
                    .authenticate_publickey(&config.ssh_username, key_with_algo)
                    .await
                    .map_err(|e| format!("Auth error: {}", e))?
                    .success()
            }
        };

        if !auth_success {
            return Err("Authentication failed".to_string());
        }

        session
            .disconnect(Disconnect::ByApplication, "", "en")
            .await
            .map_err(|e| format!("Disconnect error: {}", e))?;

        Ok(())
    }
}
