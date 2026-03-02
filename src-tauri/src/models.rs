use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    Password,
    PrivateKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ForwardingDirection {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelConfig {
    pub name: String,
    pub ssh_host: String,
    pub ssh_port: u16,
    pub ssh_username: String,
    pub auth_method: AuthMethod,
    pub forwarding_direction: ForwardingDirection,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_start: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "type", content = "message")]
pub enum TunnelStatus {
    Stopped,
    Connecting,
    Active,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelInfo {
    pub id: String,
    pub config: TunnelConfig,
    pub status: TunnelStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusChangedPayload {
    pub id: String,
    pub status: TunnelStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogPayload {
    pub id: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelStartedPayload {
    pub id: String,
    pub config: TunnelConfig,
}
