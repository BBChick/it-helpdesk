use serde_json::json;
use std::net::UdpSocket;
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Duration;
use tauri_plugin_autostart::MacosLauncher;
use tauri::{
    AppHandle, Manager, State,
    menu::{Menu, MenuItem, PredefinedMenuItem, MenuEvent},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
};
use std::sync::Mutex;
use tauri_plugin_notification::NotificationExt;

#[derive(Default)]
struct SysInfoCache {
    info: Option<serde_json::Value>,
}

fn collect_system_info() -> serde_json::Value {
    let username = whoami::realname();
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "Unknown".to_string());
    let ip_address = let_system_get_ip().unwrap_or_else(|| "127.0.0.1".to_string());

    let output = Command::new("powershell")
        .args([
            "-Command",
            "Get-Printer | Select-Object -ExpandProperty Name",
        ])
        .creation_flags(0x08000000) 
        .output();

    let printers = if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        stdout
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
    } else {
        vec![]
    };

    json!({
        "username": username,
        "hostname": hostname,
        "ip": ip_address,
        "os": format!("Windows {}", whoami::platform()),
        "devices": printers
    })
}

#[tauri::command]
fn get_system_info(state: State<Mutex<SysInfoCache>>) -> serde_json::Value {
    let mut cache = state.lock().unwrap();
    if cache.info.is_none() {
        cache.info = Some(collect_system_info());
    }
    cache.info.clone().unwrap()
}

#[tauri::command]
async fn discover_server() -> String {
    let socket2 = match socket2::Socket::new(
        socket2::Domain::IPV4,
        socket2::Type::DGRAM,
        Some(socket2::Protocol::UDP),
    ) {
        Ok(s) => s,
        Err(_) => return "error".to_string(),
    };

    let _ = socket2.set_reuse_address(true);
    let addr: std::net::SocketAddr = "0.0.0.0:41234".parse().unwrap();
    
    if socket2.bind(&addr.into()).is_err() {
        return "error".to_string();
    }

    let socket: UdpSocket = socket2.into();
    let _ = socket.set_read_timeout(Some(Duration::from_millis(1500)));
    let mut buf = [0; 1024];

    match socket.recv_from(&mut buf) {
        Ok((amt, src)) => {
            let msg = String::from_utf8_lossy(&buf[..amt]);
            if msg == "ZENOPS_SERVER" {
                return src.ip().to_string(); 
            }
            "not_found".to_string()
        }
        Err(_) => "not_found".to_string(),
    }
}

fn let_system_get_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
}

#[tauri::command]
fn show_notification(app: tauri::AppHandle, title: String, body: String) {
    let _ = app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show();
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SysInfoCache::default()))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--silent"])))
        .plugin(tauri_plugin_notification::init()) 
        .setup(|app| {
            let alert_i = MenuItem::with_id(app, "alert", "🔥 Сообщить об ошибке", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Развернуть окно", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выход из Techly", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&alert_i, &show_i, &separator, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Techly Support Client")
                // ИСПРАВЛЕНИЕ: Добавлены строгие типы |app: &AppHandle, event: MenuEvent|
                .on_menu_event(|app: &AppHandle, event: MenuEvent| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" | "alert" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
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
            
            let state: State<Mutex<SysInfoCache>> = app.state();
            let mut cache = state.lock().unwrap();
            cache.info = Some(collect_system_info());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            discover_server,
            show_notification, 
            close_window,
            minimize_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}