use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value; // Pour parser la date

// Structure pour parser l'objet date JSON de PowerShell
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
struct PsDateObject {
    date_time: Option<String>,
}

// Structure pour parser le JSON de Get-ComputerRestorePoint
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsRestorePoint {
    sequence_number: u32,
    description: String,
    restore_point_type: u32, // Type est un entier (0=AppInstall, 1=AppUninstall, etc.)
    creation_time: Option<Value>, // Gérer la date comme objet
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct RestorePointInfo {
    sequence_number: u32,
    description: String,
    restore_point_type: String, // On convertira l'entier en string
    creation_time: String,
}

#[command]
pub async fn list_restore_points(app: AppHandle) -> Result<Vec<RestorePointInfo>, String> {
    println!("Real: list_restore_points() called");

    // Sélectionner les propriétés et convertir en JSON
    let command = "Get-ComputerRestorePoint | Select-Object SequenceNumber, Description, RestorePointType, CreationTime | ConvertTo-Json -Depth 3 -Compress";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-ComputerRestorePoint: {}", e))?;

    // Get-ComputerRestorePoint peut échouer si la restauration système est désactivée
    if !output.status.success() {
        return Err(format!("Get-ComputerRestorePoint a échoué: {:?} \nErreur: {} \n(La restauration système est peut-être désactivée)", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let points_json_str = String::from_utf8_lossy(&output.stdout);

    if points_json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parser la sortie JSON (peut être un objet unique ou un tableau)
    let parsed_points: Vec<PsRestorePoint> = if points_json_str.trim().starts_with('[') {
        serde_json::from_str(&points_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) points de restauration: {}\nJSON: {}", e, points_json_str))?
    } else {
        serde_json::from_str::<PsRestorePoint>(&points_json_str)
            .map(|point| vec![point])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) points de restauration: {}\nJSON: {}", e, points_json_str))?
    };

    // Mapper vers la structure finale
    let final_points = parsed_points.into_iter().map(|ps_point| {
        let creation_time_str = ps_point.creation_time
            .as_ref()
            .and_then(|v| v.get("DateTime"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "N/A".to_string());

        // Convertir le type de point de restauration en string
        let type_str = match ps_point.restore_point_type {
            0 => "APPLICATION_INSTALL".to_string(),
            1 => "APPLICATION_UNINSTALL".to_string(),
            12 => "SYSTEM".to_string(), // Vérifier d'autres valeurs communes
            13 => "DEVICE_DRIVER_INSTALL".to_string(),
            _ => format!("Inconnu ({})", ps_point.restore_point_type),
        };

        RestorePointInfo {
            sequence_number: ps_point.sequence_number,
            description: ps_point.description,
            restore_point_type: type_str,
            creation_time: creation_time_str,
        }
    }).collect();

    Ok(final_points)
}

// --- Nouvelle commande d'action --- 

#[command]
pub async fn create_restore_point(app: AppHandle, description: String) -> Result<(), String> {
    println!("Real: create_restore_point('{}') called", description);

    // Vérifier si une description a été fournie
    if description.trim().is_empty() {
        return Err("La description ne peut pas être vide.".to_string());
    }

    // Important: Nécessite des privilèges admin
    // Utiliser MODIFY_SETTINGS comme type générique, ou ajuster si besoin
    let command = format!(
        "Checkpoint-Computer -Description \"{}\" -RestorePointType MODIFY_SETTINGS",
        description.replace('"', "'") // Échapper les guillemets simples pour PowerShell
    );

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) 
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Checkpoint-Computer: {}", e))?;

    if !output.status.success() {
        return Err(format!("Checkpoint-Computer a échoué: {:?} \nErreur: {} \n(Vérifiez les privilèges admin et si la restauration système est active)", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        Ok(())
    }
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn backup_placeholder() -> Result<(), String> {
    println!("Placeholder: backup command called");
    Err("Placeholder non utilisé".to_string())
}
*/ 