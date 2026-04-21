use std::sync::{Arc, Mutex};
use std::fs;
use axum::{
    routing::{get, post},
    response::Json,
    Router,
    extract::State,
};
use tower_http::cors::CorsLayer;
use serde::{Serialize, Deserialize};
use socketioxide::{SocketIo, extract::*};
use tauri::{AppHandle, Manager};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, MenuEvent},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Ticket {
    #[serde(default)] id: String,
    user: String,
    issue: String,
    ip: String,
    os: String,
    office: String,
    phone: String,
    #[serde(default)] status: String,
    #[serde(default)] time: String,
    #[serde(default)] date: String,
}

struct CombinedState {
    tickets: Mutex<Vec<Ticket>>,
    file_path: std::path::PathBuf,
    io: SocketIo,
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    window.hide().unwrap();
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    window.minimize().unwrap();
}

#[tauri::command]
fn toggle_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().unwrap();
    } else {
        window.maximize().unwrap();
    }
}

async fn get_tickets_api(State(state): State<Arc<CombinedState>>) -> Json<Vec<Ticket>> {
    let tickets = state.tickets.lock().unwrap();
    Json(tickets.clone())
}

async fn send_ticket_api(
    State(state): State<Arc<CombinedState>>,
    axum::extract::Json(mut t): axum::extract::Json<Ticket>,
) -> Json<serde_json::Value> {
    
    let generated_id = chrono::Local::now().timestamp_millis().to_string();
    t.id = generated_id.clone();
    t.status = "pending".to_string();
    t.time = chrono::Local::now().format("%H:%M").to_string();
    t.date = chrono::Local::now().format("%d.%m.%Y").to_string(); 
    
    let json_data = {
        let mut tickets = state.tickets.lock().unwrap();
        tickets.push(t);
        serde_json::to_string_pretty(&*tickets).unwrap_or_default()
    }; 
    
    if !json_data.is_empty() {
        let _ = fs::write(&state.file_path, json_data);
    }

    Json(serde_json::json!({ "success": true, "id": generated_id }))
}

async fn update_status_api(
    State(state): State<Arc<CombinedState>>,
    axum::extract::Json(payload): axum::extract::Json<serde_json::Value>,
) -> Json<serde_json::Value> {
    let id = payload["id"].as_str().unwrap_or("");
    let new_status = payload["status"].as_str().unwrap_or("");
    
    let json_data = {
        let mut tickets = state.tickets.lock().unwrap();
        if let Some(ticket) = tickets.iter_mut().find(|t| t.id == id) {
            ticket.status = new_status.to_string();
        }
        serde_json::to_string_pretty(&*tickets).unwrap_or_default()
    };

    if !json_data.is_empty() {
        let _ = fs::write(&state.file_path, json_data);
    }

    let _ = state.io.emit("ticket_update", &serde_json::json!({
        "id": id,
        "status": new_status
    }));
    
    Json(serde_json::json!({ "success": true }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (layer, io) = SocketIo::builder().build_layer();

    io.ns("/", |_socket: SocketRef| {});

    tauri::Builder::default()
        .setup(move |app| {
            let path = app.path().app_data_dir().expect("Не удалось получить путь к данным");
            fs::create_dir_all(&path).ok();
            let file_path = path.join("history.json");
            let file_path_clone = file_path.clone();

            let initial_tickets = if file_path.exists() {
                let data = fs::read_to_string(&file_path).unwrap_or_default();
                serde_json::from_str(&data).unwrap_or_default()
            } else {
                vec![]
            };

            let state = Arc::new(CombinedState {
                tickets: Mutex::new(initial_tickets),
                file_path,
                io: io.clone(), 
            });

            let show_i = MenuItem::with_id(app, "show", "Развернуть админку", true, None::<&str>)?;
            let clear_i = MenuItem::with_id(app, "clear", "Очистить все логи (!)", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выйти из системы", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_i, &clear_i, &separator, &quit_i])?;

            let state_for_tray = state.clone();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Techly Admin Dashboard")
                // ИСПРАВЛЕНИЕ: Добавлены строгие типы |app: &AppHandle, event: MenuEvent|
                .on_menu_event(move |app: &AppHandle, event: MenuEvent| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "clear" => {
                            let mut tickets = state_for_tray.tickets.lock().unwrap();
                            tickets.clear();
                            let _ = fs::write(&file_path_clone, "[]");
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.eval("window.location.reload()");
                            }
                        }
                        _ => {}
                    }
                })
                // ИСПРАВЛЕНИЕ: Добавлены строгие типы для трея
                .on_tray_icon_event(|tray: &TrayIcon, event: TrayIconEvent| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            let server_state = state.clone();
            let server_layer = layer.clone(); 
            tauri::async_runtime::spawn(async move {
                let api_router = Router::new()
                    .route("/get-tickets", get(get_tickets_api))
                    .route("/send-ticket", post(send_ticket_api))
                    .route("/update-status", post(update_status_api))
                    .layer(CorsLayer::permissive())
                    .layer(server_layer) 
                    .with_state(server_state);

                let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
                axum::serve(listener, api_router).await.unwrap();
            });

            tauri::async_runtime::spawn(async move {
                let socket = std::net::UdpSocket::bind("0.0.0.0:0").unwrap();
                socket.set_broadcast(true).ok();
                loop {
                    socket.send_to(b"ZENOPS_SERVER", "255.255.255.255:41234").ok();
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await; 
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![close_window, minimize_window, toggle_maximize])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}