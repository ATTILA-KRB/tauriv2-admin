use serde::Serialize;
use std::result::Result;
use tauri::command;
// Nous aurons besoin d'AppHandle pour accéder à l'API Shell
use tauri::AppHandle;
// Importer les types nécessaires de tauri_plugin_shell
use tauri_plugin_shell::ShellExt;

// Structure pour les informations de service Windows
#[derive(Serialize, Debug, Clone)]
pub struct ServiceInfo {
    name: String,
    display_name: String,
    status: String, // Ex: Running, Stopped
    start_type: String, // Ex: Automatic, Manual, Disabled
}

#[command]
pub async fn list_services(app: AppHandle) -> Result<Vec<ServiceInfo>, String> {
    println!("Real: list_services() called");

    // Commande PowerShell améliorée avec gestion d'erreurs et formatage propre
    // Utilisation d'un bloc try/catch pour capturer d'éventuelles erreurs PowerShell
    let command = r#"
    try {
        $ErrorActionPreference = 'Stop'
        $services = Get-Service | Select-Object -Property Name, DisplayName, Status, StartType
        
        # Vérifier si des services ont été trouvés
        if ($null -eq $services -or $services.Count -eq 0) {
            Write-Output "[]"  # Renvoyer un tableau vide en JSON
        } else {
            # Conversion en JSON propre
            $jsonResult = $services | ConvertTo-Json -Depth 1 -Compress
            $jsonResult
        }
    } catch {
        Write-Error "Erreur PowerShell: $_"
        exit 1
    }
    "#;

    // Exécuter la commande via l'API Shell du plugin
    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de PowerShell: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "La commande PowerShell a échoué: {:?}\nErreur: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    
    // S'assurer que la sortie n'est pas vide
    if stdout.trim().is_empty() {
        return Ok(vec![]); // Retourner un tableau vide au lieu d'une erreur
    }

    let mut services = Vec::new();

    // Extraire seulement la partie JSON propre (au cas où il y aurait des messages de débogage)
    let json_start = stdout.find('[').or_else(|| stdout.find('{')).unwrap_or(0);
    let json_end = stdout.rfind(']').or_else(|| stdout.rfind('}')).map(|pos| pos + 1).unwrap_or(stdout.len());
    
    let json_str = if json_start < json_end {
        &stdout[json_start..json_end]
    } else {
        &stdout
    };

    // Parser la sortie JSON
    match serde_json::from_str::<serde_json::Value>(json_str) {
        Ok(json) => {
            // Si c'est un tableau (plusieurs services)
            if let Some(services_array) = json.as_array() {
                for service in services_array {
                    let name = service.get("Name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                    let display_name = service.get("DisplayName").and_then(|v| v.as_str()).unwrap_or("Unknown Display Name").to_string();
                    
                    // Gérer différents formats possibles pour Status et StartType (string ou entier)
                    let status = if let Some(status_str) = service.get("Status").and_then(|v| v.as_str()) {
                        status_str.to_string()
                    } else if let Some(status_num) = service.get("Status").and_then(|v| v.as_i64()) {
                        // Convertir le code numérique en texte
                        match status_num {
                            1 => "Stopped".to_string(),
                            2 => "Starting".to_string(),
                            3 => "Stopping".to_string(),
                            4 => "Running".to_string(),
                            7 => "Paused".to_string(),
                            _ => format!("Unknown ({})", status_num),
                        }
                    } else {
                        "Unknown".to_string()
                    };

                    let start_type = if let Some(start_type_str) = service.get("StartType").and_then(|v| v.as_str()) {
                        start_type_str.to_string()
                    } else if let Some(start_type_num) = service.get("StartType").and_then(|v| v.as_i64()) {
                        // Convertir le code numérique en texte
                        match start_type_num {
                            1 => "System".to_string(),
                            2 => "Auto".to_string(),
                            3 => "Manual".to_string(),
                            4 => "Disabled".to_string(),
                            _ => format!("Unknown ({})", start_type_num),
                        }
                    } else {
                        "Unknown".to_string()
                    };

                    services.push(ServiceInfo {
                        name,
                        display_name,
                        status,
                        start_type,
                    });
                }
            } 
            // Si c'est un objet unique (un seul service)
            else if json.is_object() {
                let name = json.get("Name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                let display_name = json.get("DisplayName").and_then(|v| v.as_str()).unwrap_or("Unknown Display Name").to_string();
                
                // Même logique que ci-dessus pour Status et StartType
                let status = if let Some(status_str) = json.get("Status").and_then(|v| v.as_str()) {
                    status_str.to_string()
                } else if let Some(status_num) = json.get("Status").and_then(|v| v.as_i64()) {
                    match status_num {
                        1 => "Stopped".to_string(),
                        2 => "Starting".to_string(),
                        3 => "Stopping".to_string(),
                        4 => "Running".to_string(),
                        7 => "Paused".to_string(),
                        _ => format!("Unknown ({})", status_num),
                    }
                } else {
                    "Unknown".to_string()
                };

                let start_type = if let Some(start_type_str) = json.get("StartType").and_then(|v| v.as_str()) {
                    start_type_str.to_string()
                } else if let Some(start_type_num) = json.get("StartType").and_then(|v| v.as_i64()) {
                    match start_type_num {
                        1 => "System".to_string(),
                        2 => "Auto".to_string(),
                        3 => "Manual".to_string(),
                        4 => "Disabled".to_string(),
                        _ => format!("Unknown ({})", start_type_num),
                    }
                } else {
                    "Unknown".to_string()
                };

                services.push(ServiceInfo {
                    name,
                    display_name,
                    status,
                    start_type,
                });
            }
        },
        Err(e) => {
            println!("Erreur lors du parsing JSON: {}", e);
            println!("Sortie brute: {}", stdout);
            return Ok(vec![]); // Retourner un tableau vide pour éviter de bloquer l'application
        }
    }

    // Même si aucun service n'est trouvé, on renvoie un tableau vide au lieu d'une erreur
    Ok(services)
}

// --- Nouvelles commandes d'action --- 

#[command]
pub async fn start_service(app: AppHandle, service_name: String) -> Result<(), String> {
    println!("Real: start_service('{}') called", service_name);

    // Utiliser -PassThru pour vérifier si le service a démarré (optionnel, mais utile)
    // Important: Nécessite des privilèges admin
    let command = format!("Start-Service -Name \"{}\"", service_name);

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) 
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Start-Service pour '{}': {}", service_name, e))?;

    if !output.status.success() {
        return Err(format!("Start-Service pour '{}' a échoué: {:?} \nErreur: {}", 
            service_name, output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        // Vérifier stdout si -PassThru est utilisé, sinon Ok est suffisant
        Ok(())
    }
}

#[command]
pub async fn stop_service(app: AppHandle, service_name: String) -> Result<(), String> {
    println!("Real: stop_service('{}') called", service_name);

    // Utiliser -PassThru pour vérifier si le service s'est arrêté
    // Important: Nécessite des privilèges admin
    let command = format!("Stop-Service -Name \"{}\"", service_name);

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) 
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Stop-Service pour '{}': {}", service_name, e))?;

    // Stop-Service peut retourner un code d'erreur si le service ne peut pas être arrêté (ex: dépendances)
    if !output.status.success() {
        return Err(format!("Stop-Service pour '{}' a échoué: {:?} \nErreur: {}", 
            service_name, output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
         Ok(())
    }
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn windows_service_placeholder() -> Result<(), String> {
    println!("Placeholder: windows_service command called");
    Err("Placeholder non utilisé".to_string())
}
*/ 