mod modules;

use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Manager;

// Structure simplement pour la compatibilité avec le code existant
#[derive(Clone)]
struct ServerState {
    is_ready: Arc<Mutex<bool>>,
}

impl Default for ServerState {
    fn default() -> Self {
        Self {
            is_ready: Arc::new(Mutex::new(true)), // Toujours prêt par défaut
        }
    }
}

// Commande pour vérifier si le serveur est prêt
#[tauri::command]
fn is_server_ready(state: tauri::State<ServerState>) -> bool {
    true // Toujours retourner true
}

// Commande pour obtenir le port du serveur
#[tauri::command]
fn get_server_port() -> u16 {
    0 // Port fictif
}

// Nouvelle commande pour obtenir l'erreur du serveur
#[tauri::command]
fn get_server_error(_state: tauri::State<ServerState>) -> Option<String> {
    None // Jamais d'erreur
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
      // Commandes pour le serveur (fictif)
      is_server_ready,
      get_server_port,
      get_server_error,
      modules::updates::install_pswindowsupdate_module,
      modules::updates::install_windows_updates,
      modules::updates::install_defender_updates,
    ])
    .build(tauri::generate_context!("tauri.conf.json"))
    .expect("Failed to build Tauri application")
    .run(|_app_handle, event| match event {
      tauri::RunEvent::Ready { .. } => {
        // Nous ne démarrons plus de serveur local
        // Le serveur est redondant car Tauri gère déjà la communication front/back
      }
      tauri::RunEvent::ExitRequested { api, .. } => {
        api.prevent_exit();
      }
      _ => {}
    });
}
