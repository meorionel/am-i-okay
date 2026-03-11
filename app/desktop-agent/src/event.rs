use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct ActivityEnvelope {
    #[serde(rename = "type")]
    pub message_type: &'static str,
    pub payload: ActivityPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityPayload {
    pub event_id: String,
    pub ts: String,
    pub device_id: String,
    pub platform: &'static str,
    pub kind: &'static str,
    pub app: AppInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_title: Option<String>,
    pub source: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub pid: i32,
}

impl ActivityEnvelope {
    pub fn foreground_changed(
        device_id: &str,
        platform: &'static str,
        source: &'static str,
        mut app: AppInfo,
        window_title: Option<String>,
    ) -> Self {
        if app.title.is_none() {
            app.title = window_title.clone();
        }

        Self {
            message_type: "activity",
            payload: ActivityPayload {
                event_id: Uuid::new_v4().to_string(),
                ts: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
                device_id: device_id.to_string(),
                platform,
                kind: "foreground_changed",
                app,
                window_title,
                source,
            },
        }
    }
}
