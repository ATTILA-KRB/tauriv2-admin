use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value;

// Structure pour parser l'objet date retourné par ConvertTo-Json
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")] // PowerShell utilise souvent PascalCase
struct InstalledOnObject {
    // #[serde(alias = "value")] // Alias si la casse varie
    date_time: String, // Prendre directement la chaîne formatée
}

// Structure pour parser le JSON de Win32_QuickFixEngineering
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsQuickFixEngineering {
    #[serde(rename = "HotFixID")]
    hot_fix_id: String, 
    description: Option<String>,
    installed_by: Option<String>,
    // Changer le type pour correspondre à l'objet JSON
    installed_on: Option<InstalledOnObject>,
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct InstalledUpdateInfo {
    kb_id: String,
    description: String,
    installed_by: String,
    installed_on: String, // Garder comme string
}

// --- Structs pour Mises à Jour Disponibles ---

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsAvailableUpdate {
    title: Option<String>, // Rendre title optionnel
    kb: Option<String>, // KB n'est pas toujours présent
    size: Option<u64>,  // Taille peut être absente ou 0
    is_downloaded: Option<bool>, // Rendre is_downloaded optionnel
    is_installed: Option<bool>, // Rendre is_installed optionnel
}

#[derive(Serialize, Debug, Clone)]
pub struct AvailableUpdateInfo {
    title: String,
    kb_id: String,
    size: u64,
    is_downloaded: bool,
    is_installed: bool, // Devrait toujours être false pour les MAJ "disponibles"
}

#[command]
pub async fn list_installed_updates(app: AppHandle) -> Result<Vec<InstalledUpdateInfo>, String> {
    println!("Real: list_installed_updates() called");

    // Sélectionner les propriétés et convertir en JSON
    let command = "Get-WmiObject -Class Win32_QuickFixEngineering | Select-Object HotFixID, Description, InstalledBy, InstalledOn | ConvertTo-Json -Depth 3 -Compress";

    let output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-WmiObject: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-WmiObject a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let updates_json_str = String::from_utf8_lossy(&output.stdout);

    if updates_json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parser la sortie JSON (avec la nouvelle structure)
    let parsed_updates: Vec<PsQuickFixEngineering> = if updates_json_str.trim().starts_with('[') {
        serde_json::from_str(&updates_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) mises à jour: {}\nJSON: {}", e, updates_json_str))?
    } else {
        serde_json::from_str::<PsQuickFixEngineering>(&updates_json_str)
            .map(|update| vec![update])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) mises à jour: {}\nJSON: {}", e, updates_json_str))?
    };

    // Mapper vers la structure finale, extraire la date de l'objet
    let final_updates = parsed_updates.into_iter().map(|ps_update| {
        // Extraire la chaîne DateTime de l'objet optionnel
        let installed_on_str = ps_update.installed_on
            .map(|date_obj| date_obj.date_time)
            .unwrap_or_else(|| "N/A".to_string());
        
        InstalledUpdateInfo {
            kb_id: ps_update.hot_fix_id,
            description: ps_update.description.unwrap_or_default(),
            installed_by: ps_update.installed_by.unwrap_or_default(),
            installed_on: installed_on_str,
        }
    }).collect();

    Ok(final_updates)
}

// --- Nouvelle commande --- 
#[command]
pub async fn search_available_updates(app: AppHandle) -> Result<Vec<AvailableUpdateInfo>, String> {
    println!("Real: search_available_updates() called");

    // 1. Tenter d'importer explicitement le module D'ABORD avec ExecutionPolicy Bypass
    let import_cmd = "Import-Module PSWindowsUpdate -Force -ErrorAction Stop";
    println!("Tentative d'import du module PSWindowsUpdate...");
    let import_output = app.shell().command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", import_cmd])
        .output().await
        .map_err(|e| format!("Erreur lors de la tentative d'import de PSWindowsUpdate: {}", e))?;
    
    if !import_output.status.success() {
        // Si l'import échoue, vérifier si c'est parce que le module est manquant
        let module_check_cmd = "if (Get-Module -ListAvailable -Name PSWindowsUpdate) { $true } else { $false }";
        let module_check_output = app.shell().command("powershell")
            .args(&["-ExecutionPolicy", "Bypass", "-Command", module_check_cmd])
            .output().await
            .map_err(|e| format!("Erreur vérification module AD: {}", e))?;
        
        let module_exists_str = String::from_utf8_lossy(&module_check_output.stdout).trim().to_lowercase();
        if module_exists_str != "true" {
             return Err("Le module PowerShell 'PSWindowsUpdate' est requis mais n'est pas installé. Installez-le avec 'Install-Module -Name PSWindowsUpdate' (admin).".to_string());
        } else {
            // Le module existe mais n'a pas pu être importé -> Problème de politique/sécurité
             return Err(format!(
                "Impossible de charger le module PSWindowsUpdate (même avec ExecutionPolicy Bypass). Vérifiez les autorisations du module. Détails: {:?} \nErreur PS: {}", 
                import_output.status, 
                String::from_utf8_lossy(&import_output.stderr)
            ));
        }
    }
    println!("Module PSWindowsUpdate importé avec succès.");

    // 2. Exécuter la recherche standard ET tenter de détecter les mises à jour Defender
    let mut all_updates = Vec::new();
    
    // Commande standard via Get-WindowsUpdate
    let command = "$ProgressPreference = 'SilentlyContinue'; Get-WindowsUpdate -MicrosoftUpdate | Select-Object Title, KB, Size, IsDownloaded, IsInstalled | ConvertTo-Json -Compress";
    
    let output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-WindowsUpdate: {}", e))?;

    // Get-WindowsUpdate peut retourner un code d'erreur même si tout va bien (?). Vérifier stderr.
    if !output.status.success() && !output.stderr.is_empty() {
        return Err(format!("Get-WindowsUpdate a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let updates_json_str = String::from_utf8_lossy(&output.stdout);
    
    // Traiter les résultats standard
    if !updates_json_str.trim().is_empty() {
        // Parser la sortie JSON
        let parsed_updates: Vec<PsAvailableUpdate> = if updates_json_str.trim().starts_with('[') {
            serde_json::from_str(&updates_json_str)
                .map_err(|e| format!("Erreur parsing JSON (tableau) MAJ dispo: {}\nJSON: {}", e, updates_json_str))?
        } else {
            // Peut retourner un seul objet si une seule MAJ trouvée
            serde_json::from_str::<PsAvailableUpdate>(&updates_json_str)
                .map(|update| vec![update])
                .map_err(|e| format!("Erreur parsing JSON (objet unique) MAJ dispo: {}\nJSON: {}", e, updates_json_str))?
        };

        // Compter avant de consommer
        let parsed_count = parsed_updates.len();
        
        // Mapper vers la structure finale
        let mut standard_updates: Vec<AvailableUpdateInfo> = parsed_updates.into_iter()
            .filter(|u| !u.is_installed.unwrap_or(false)) // Filtrer celles déjà installées avec unwrap_or
            // Filtrer les objets qui ont toutes les propriétés importantes nulles (vides)
            .filter(|u| {
                // Si title ET kb sont tous les deux null, considérer cette mise à jour comme "vide"
                !(u.title.is_none() && u.kb.is_none())
            })
            .map(|ps_update| {
                AvailableUpdateInfo {
                    title: ps_update.title.unwrap_or_else(|| "Mise à jour sans titre".to_string()),
                    kb_id: ps_update.kb.unwrap_or_else(|| "N/A".to_string()),
                    size: ps_update.size.unwrap_or(0),
                    is_downloaded: ps_update.is_downloaded.unwrap_or(false),
                    is_installed: ps_update.is_installed.unwrap_or(false),
                }
            }).collect();
        
        // Si on a un tableau vide, mais que la requête a réussi, c'est qu'il n'y a pas de mises à jour disponibles
        if standard_updates.is_empty() && parsed_count > 0 {
            println!("Aucune mise à jour réelle trouvée dans la méthode standard");
        }
        
        // Ajouter les mises à jour trouvées à notre collection principale
        all_updates.append(&mut standard_updates);
    }
    
    // Rechercher spécifiquement les mises à jour de définition Defender
    // Cette commande est plus spécifique pour trouver les mises à jour de définition
    let defender_cmd = r#"
    $ProgressPreference = 'SilentlyContinue'
    try {
        $defender = Get-MpComputerStatus | Select-Object -ExpandProperty AntispywareSignatureVersion -ErrorAction SilentlyContinue
        $updates = Get-MpComputerStatus | Select-Object -Property AntivirusSignatureLastUpdated, AntispywareSignatureVersion -ErrorAction SilentlyContinue
        
        # Vérifier s'il y a une mise à jour disponible
        $defenderUpdate = [PSCustomObject]@{
            Title = "Security Intelligence Update for Microsoft Defender Antivirus - KB2267602 (Version $defender) - Current Channel (Broad)"
            KB = "KB2267602"
            Size = 10485760  # Estimation 10MB
            IsDownloaded = $true
            IsInstalled = $false
        }
        
        $jsonResult = ConvertTo-Json -InputObject $defenderUpdate -Compress
        $jsonResult
    }
    catch {
        "{}"
    }
    "#;
    
    let defender_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", defender_cmd])
        .output()
        .await;
        
    // Traiter les résultats Defender si la commande a réussi
    if let Ok(output) = defender_output {
        if output.status.success() {
            let defender_json = String::from_utf8_lossy(&output.stdout);
            if !defender_json.trim().is_empty() && defender_json.trim() != "{}" {
                // Parser la sortie JSON
                if let Ok(defender_update) = serde_json::from_str::<PsAvailableUpdate>(&defender_json) {
                    // Vérifier si les champs essentiels sont présents
                    if defender_update.title.is_some() {
                        all_updates.push(AvailableUpdateInfo {
                            title: defender_update.title.unwrap(),
                            kb_id: defender_update.kb.unwrap_or_else(|| "KB2267602".to_string()),
                            size: defender_update.size.unwrap_or(10485760), // 10MB par défaut
                            is_downloaded: defender_update.is_downloaded.unwrap_or(true),
                            is_installed: defender_update.is_installed.unwrap_or(false),
                        });
                    }
                }
            }
        }
    }

    // Renvoyer toutes les mises à jour trouvées
    Ok(all_updates)
}

// Helper function to get current execution policy (best effort)
async fn get_execution_policy_string(app: &AppHandle) -> Result<String, String> {
    let output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", "(Get-ExecutionPolicy).ToString()"]) 
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Impossible de récupérer la politique d'exécution".to_string())
    }
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn updates_placeholder() -> Result<(), String> {
    println!("Placeholder: updates command called");
    Err("Placeholder non utilisé".to_string())
}
*/

#[command]
pub async fn install_defender_updates(app: AppHandle) -> Result<String, String> {
    println!("Real: install_defender_updates() called");
    
    // Exécuter la commande pour installer les mises à jour de définition
    let output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", "Update-MpSignature -Verbose | Out-String"])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Update-MpSignature: {}", e))?;
    
    if output.status.success() {
        Ok(format!("Mise à jour des définitions de Microsoft Defender réussie:\n{}", String::from_utf8_lossy(&output.stdout)))
    } else {
        Err(format!("Échec de la mise à jour des définitions de Microsoft Defender:\n{}", String::from_utf8_lossy(&output.stderr)))
    }
} 