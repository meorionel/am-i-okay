use std::time::Duration;

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{info, warn};

use crate::event::ActivityEnvelope;

pub async fn run_transport(
    url: String,
    mut rx: mpsc::UnboundedReceiver<ActivityEnvelope>,
) -> Result<()> {
    let mut reconnect_delay = Duration::from_secs(2);
    let max_reconnect_delay = Duration::from_secs(30);

    let mut pending: Option<ActivityEnvelope> = None;

    loop {
        info!(%url, "connecting websocket");
        match connect_async(&url).await {
            Ok((ws_stream, _)) => {
                info!("websocket connected");
                reconnect_delay = Duration::from_secs(2);

                let (mut write, mut read) = ws_stream.split();

                loop {
                    if let Some(event) = pending.take() {
                        if let Err(err) = send_event(&mut write, &event).await {
                            warn!(error = %err, "send failed, reconnecting");
                            pending = Some(event);
                            break;
                        }
                        continue;
                    }

                    tokio::select! {
                        maybe_message = read.next() => {
                            match maybe_message {
                                Some(Ok(Message::Close(frame))) => {
                                    warn!(?frame, "websocket closed by server, reconnecting");
                                    break;
                                }
                                Some(Ok(_)) => {}
                                Some(Err(err)) => {
                                    warn!(error = %err, "websocket read failed, reconnecting");
                                    break;
                                }
                                None => {
                                    warn!("websocket stream ended, reconnecting");
                                    break;
                                }
                            }
                        }
                        maybe_event = rx.recv() => {
                            let Some(event) = maybe_event else {
                                info!("event channel closed, transport exiting");
                                return Ok(());
                            };

                            if let Err(err) = send_event(&mut write, &event).await {
                                warn!(error = %err, "send failed, reconnecting");
                                pending = Some(event);
                                break;
                            }
                        }
                    }
                }
            }
            Err(err) => {
                warn!(error = %err, "websocket connect failed, retrying");
            }
        }

        info!(
            delay_secs = reconnect_delay.as_secs(),
            "reconnect scheduled"
        );
        sleep(reconnect_delay).await;
        reconnect_delay = std::cmp::min(max_reconnect_delay, reconnect_delay.saturating_mul(2));
    }
}

async fn send_event(
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
    event: &ActivityEnvelope,
) -> Result<()> {
    let message = serde_json::to_string(event)?;
    write.send(Message::Text(message.into())).await?;
    info!(
        app_id = %event.payload.app.id,
        pid = event.payload.app.pid,
        "event sent"
    );
    Ok(())
}
