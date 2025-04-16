use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsPnpDevice {
    instance_id: String,
    friendly_name: Option<String>,
    class: Option<String>,
    manufacturer: Option<String>,
    status: String, // OK, Error, Degraded, Unknown, Disabled
}

#[derive(Serialize, Debug, Clone)]
pub struct DeviceInfo {
    instance_id: String,
    name: String,
    class: String,
    manufacturer: String,
    status: String,
}

#[command]
pub async fn list_devices(app: AppHandle) -> Result<Vec<DeviceInfo>, String> {
    // Définir les classes PnP d'intérêt
    let classes_of_interest = vec![
        "Display", "Net", "USB", "AudioEndpoint", "Image", 
        "PrintQueue", "DiskDrive", /* "Ports", */ "Media", "Bluetooth"
        // Ajouter d'autres classes si pertinent
    ];
    // Formatter la liste des classes pour le paramètre -Class
    let class_filter = classes_of_interest.iter()
        .map(|&c| format!("'{}'", c))
        .collect::<Vec<_>>()
        .join(",");

    // Modifier la commande pour utiliser le filtre de classe
    let command = format!(
        "Get-PnpDevice -Class {} | Select-Object InstanceID, FriendlyName, Class, Manufacturer, Status | ConvertTo-Json -Compress",
        class_filter
    );
    
    println!("Real: list_devices(filter: {}) called", class_filter);

    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e|e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    let json_str = String::from_utf8_lossy(&output.stdout);
    if json_str.trim().is_empty() { return Ok(vec![]); }
    let parsed: Vec<PsPnpDevice> = serde_json::from_str(&json_str).map_err(|e|e.to_string())?;
    let final_devs = parsed.into_iter().map(|d| DeviceInfo {
        instance_id: d.instance_id,
        name: d.friendly_name.unwrap_or_else(|| "(Inconnu)".to_string()),
        class: d.class.unwrap_or_default(),
        manufacturer: d.manufacturer.unwrap_or_default(),
        status: d.status,
    }).collect();
    Ok(final_devs)
}

#[command]
pub async fn enable_device(app: AppHandle, instance_id: String) -> Result<(), String> {
    let command = format!("Enable-PnpDevice -InstanceId \"{}\" -Confirm:$false", instance_id.replace('"',"''"));
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e|e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    Ok(())
}

#[command]
pub async fn disable_device(app: AppHandle, instance_id: String) -> Result<(), String> {
    let command = format!("Disable-PnpDevice -InstanceId \"{}\" -Confirm:$false", instance_id.replace('"',"''"));
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e|e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    Ok(())
} 