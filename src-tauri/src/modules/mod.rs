// Déclaration des modules
pub mod active_directory;
pub mod admin;
pub mod backup;
pub mod disks;
pub mod event_viewer;
pub mod hardware;
pub mod network;
pub mod security;
pub mod shares;
pub mod system;
pub mod tasks;
pub mod updates;
pub mod updater;
pub mod users;
pub mod windows_service;
pub mod devices;

// Suppression de la fonction init et des imports associés
// Le handler sera généré directement dans lib.rs 