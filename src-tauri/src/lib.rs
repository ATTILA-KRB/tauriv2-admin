mod modules;

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;
use std::io::Read;

// Port qui sera utilisé par le serveur local
const LOCAL_SERVER_PORT: u16 = 8080;

// Structure pour gérer l'état du serveur local
#[derive(Clone)]
struct ServerState {
    is_ready: Arc<Mutex<bool>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            is_ready: Arc::new(Mutex::new(false)),
        }
    }
}

// Fonction pour démarrer le serveur local
fn start_local_server(app_handle: tauri::AppHandle) {
    let state = app_handle.state::<ServerState>();
    let is_ready_clone = state.is_ready.clone();
    
    // Démarrer le serveur dans un thread séparé
    thread::spawn(move || {
        // Configuration du serveur
        let server_addr = format!("127.0.0.1:{}", LOCAL_SERVER_PORT);
        
        // Créer le serveur
        match tiny_http::Server::http(server_addr) {
            Ok(server) => {
                println!("Serveur local démarré sur http://localhost:{}", LOCAL_SERVER_PORT);
                
                // Marquer le serveur comme prêt
                {
                    let mut is_ready = is_ready_clone.lock().unwrap();
                    *is_ready = true;
                }
                
                // Émettre un événement pour informer le frontend que le serveur est prêt
                let _ = app_handle.emit("server-ready", LOCAL_SERVER_PORT);
                
                // Boucle principale du serveur pour traiter les requêtes
                for request in server.incoming_requests() {
                    // Traiter la requête
                    match request.url() {
                        "/api/status" => {
                            let response = tiny_http::Response::from_string("{\"status\":\"OK\"}");
                            let _ = request.respond(response.with_header(
                                "Content-Type: application/json".parse().unwrap()
                            ));
                        },
                        "/api/data" => {
                            let response = tiny_http::Response::from_string("{\"data\":[{\"id\":1,\"name\":\"Test\"}]}");
                            let _ = request.respond(response.with_header(
                                "Content-Type: application/json".parse().unwrap()
                            ));
                        },
                        _ => {
                            // Répondre à toutes les requêtes inconnues
                            let response = tiny_http::Response::from_string("Not Found").with_status_code(404);
                            let _ = request.respond(response);
                        }
                    }
                }
            },
            Err(err) => {
                eprintln!("Erreur lors du démarrage du serveur local: {}", err);
                // Informer l'interface utilisateur de l'échec
                let _ = app_handle.emit("server-error", format!("Erreur de serveur: {}", err));
            }
        }
    });
}

// Commande pour vérifier si le serveur est prêt
#[tauri::command]
fn is_server_ready(state: tauri::State<ServerState>) -> bool {
    let is_ready = state.is_ready.lock().unwrap();
    *is_ready
}

// Commande pour obtenir le port du serveur
#[tauri::command]
fn get_server_port() -> u16 {
    LOCAL_SERVER_PORT
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let log_plugin = {
    let filter = if cfg!(debug_assertions) {
      log::LevelFilter::Debug
    } else {
      log::LevelFilter::Info
    };
    tauri_plugin_log::Builder::new()
      .level(filter)
      .build()
  };

  let server_state = ServerState::default();

  tauri::Builder::default()
    .manage(server_state)
    .plugin(log_plugin)
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      modules::admin::is_elevated,
      modules::admin::require_admin,
      modules::disks::list_disks,
      modules::disks::analyze_recycle_bin,
      modules::disks::clear_recycle_bin,
      modules::disks::optimize_volume,
      modules::disks::format_disk,
      modules::disks::get_disk_partitions,
      modules::devices::list_devices,
      modules::devices::enable_device,
      modules::devices::disable_device,
      modules::event_viewer::get_events,
      modules::event_viewer::clear_event_log,
      modules::hardware::get_hardware_info,
      modules::network::list_network_adapters,
      modules::system::list_processes,
      modules::system::terminate_process,
      modules::system::restart_computer,
      modules::system::shutdown_computer,
      modules::system::get_system_usage,
      modules::windows_service::list_services,
      modules::windows_service::start_service,
      modules::windows_service::stop_service,
      modules::users::list_local_users,
      modules::users::list_local_groups,
      modules::users::add_local_user,
      modules::users::delete_local_user,
      modules::security::list_firewall_rules,
      modules::security::get_antivirus_status,
      modules::shares::list_shares,
      modules::shares::create_share,
      modules::shares::delete_share,
      modules::tasks::list_scheduled_tasks,
      modules::tasks::enable_task,
      modules::tasks::disable_task,
      modules::tasks::run_task,
      modules::backup::list_restore_points,
      modules::backup::create_restore_point,
      modules::updates::list_installed_updates,
      modules::updates::search_available_updates,
      modules::updater::check_for_updates,
      modules::updater::download_update,
      modules::updater::install_update,
      modules::updater::restart_app,
      modules::active_directory::get_ad_computer_info,
      modules::active_directory::get_logged_in_user_info,
      modules::active_directory::force_gp_update,
      modules::active_directory::search_ad_users,
      modules::active_directory::search_ad_computers,
      modules::active_directory::search_ad_groups,
      modules::active_directory::get_ad_group_members,
      modules::active_directory::get_ad_principal_group_membership,
      modules::active_directory::enable_ad_account,
      modules::active_directory::disable_ad_account,
      modules::active_directory::unlock_ad_account,
      modules::active_directory::reset_ad_account_password,
      // Ajouter les commandes pour le serveur
      is_server_ready,
      get_server_port
    ])
    .build(tauri::generate_context!("tauri.conf.json"))
    .expect("Failed to build Tauri application")
    .run(|app_handle, event| match event {
      tauri::RunEvent::Ready { .. } => {
        // Démarrer le serveur local quand l'application est prête
        start_local_server(app_handle.clone());
      }
      tauri::RunEvent::ExitRequested { api, .. } => {
        api.prevent_exit();
      }
      _ => {}
    });
}
