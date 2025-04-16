use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsSmbShare {
    name: String,
    path: String,
    description: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct ShareInfo {
    name: String,
    path: String,
    description: String,
}

#[command]
pub async fn list_shares(app: AppHandle) -> Result<Vec<ShareInfo>, String> {
    println!("Real: list_shares() called");
    let command = "Get-SmbShare | Select-Object Name, Path, Description | ConvertTo-Json -Compress";
    let output = app.shell().command("powershell").args(&["-Command", command]).output().await.map_err(|e| e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    let json_str = String::from_utf8_lossy(&output.stdout);
    if json_str.trim().is_empty() { return Ok(vec![]); }
    let parsed: Vec<PsSmbShare> = if json_str.trim().starts_with('[') {
        serde_json::from_str(&json_str).map_err(|e| e.to_string())?
    } else {
        serde_json::from_str::<PsSmbShare>(&json_str).map(|s| vec![s]).map_err(|e| e.to_string())?
    };
    let final_shares = parsed.into_iter().map(|ps| ShareInfo {
        name: ps.name,
        path: ps.path,
        description: ps.description.unwrap_or_default(),
    }).collect();
    Ok(final_shares)
}

#[command]
pub async fn create_share(app: AppHandle, name: String, path: String, description: Option<String>) -> Result<(), String> {
    println!("Real: create_share() called");
    // Nécessite admin
    let desc = description.unwrap_or_default().replace('"', "''");
    let command = format!("New-SmbShare -Name \"{}\" -Path \"{}\" -Description \"{}\" -FullAccess Everyone", 
        name.replace('"', "''"), path.replace('"', "''"), desc);
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e| e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    Ok(())
}

#[command]
pub async fn delete_share(app: AppHandle, name: String) -> Result<(), String> {
     println!("Real: delete_share() called");
    // Nécessite admin
    let command = format!("Remove-SmbShare -Name \"{}\" -Force", name.replace('"', "''"));
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await.map_err(|e| e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).to_string()); }
    Ok(())
} 