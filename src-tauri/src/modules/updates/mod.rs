use serde::{Deserialize, Serialize, Deserializer};
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

// Fonction pour parser les tailles avec unités (KB, MB, GB)
fn parse_size_string(size_str: &str) -> u64 {
    let size_str = size_str.trim().to_uppercase();
    
    if size_str.is_empty() || size_str == "N/A" {
        return 0;
    }
    
    // Extraire les chiffres et l'unité
    let mut number_part = String::new();
    let mut unit_part = String::new();
    
    for ch in size_str.chars() {
        if ch.is_ascii_digit() || ch == '.' || ch == ',' {
            number_part.push(ch);
        } else if ch.is_alphabetic() {
            unit_part.push(ch);
        }
    }
    
    // Convertir la partie numérique
    let number: f64 = number_part.replace(',', ".").parse().unwrap_or(0.0);
    
    // Appliquer le multiplicateur selon l'unité
    let bytes = match unit_part.as_str() {
        "KB" => (number * 1024.0) as u64,
        "MB" => (number * 1024.0 * 1024.0) as u64,
        "GB" => (number * 1024.0 * 1024.0 * 1024.0) as u64,
        "TB" => (number * 1024.0 * 1024.0 * 1024.0 * 1024.0) as u64,
        "BYTES" | "B" | "" => number as u64,
        _ => number as u64, // Fallback: considérer comme des bytes
    };
    
    bytes
}

// Deserializer personnalisé pour les tailles
fn deserialize_size<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: Deserializer<'de>,
{
    let value: Value = Deserialize::deserialize(deserializer)?;
    
    match value {
        Value::Number(n) => Ok(Some(n.as_u64().unwrap_or(0))),
        Value::String(s) => Ok(Some(parse_size_string(&s))),
        Value::Null => Ok(None),
        _ => Ok(Some(0))
    }
}

// Structure pour parser le JSON de Win32_QuickFixEngineering (garder inchangée)
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsAvailableUpdate {
    title: Option<String>,
    #[serde(rename = "KB")]
    kb: Option<String>,
    #[serde(deserialize_with = "deserialize_size")]
    size: Option<u64>,
    is_downloaded: Option<bool>,
    is_installed: Option<bool>,
}

#[derive(Serialize, Debug, Clone)]
pub struct AvailableUpdateInfo {
    title: String,
    kb_id: String,
    size: u64,
    is_downloaded: bool,
    is_installed: bool, // Devrait toujours être false pour les MAJ "disponibles"
}

// Nouvelle structure pour l'historique amélioré
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct WUHistoryUpdate {
    title: Option<String>,
    date: Option<String>,
    operation: Option<String>, // Installation, Uninstallation, etc.
    result: Option<String>,    // Succeeded, Failed, etc.
    kb: Option<String>,
    size: Option<String>,
    description: Option<String>,
}

#[command]
pub async fn list_installed_updates(app: AppHandle) -> Result<Vec<InstalledUpdateInfo>, String> {
    println!("Tentative d'import PSWindowsUpdate…");

    let mut all_updates = Vec::new();

    // Méthode 1: Essayer d'utiliser PSWindowsUpdate pour un historique complet
    let pswindowsupdate_command = r#"
    try {
        # Vérifier si PSWindowsUpdate est disponible
        if (Get-Module -ListAvailable -Name PSWindowsUpdate) {
            Import-Module PSWindowsUpdate -Force -ErrorAction Stop
            
            # Obtenir l'historique des mises à jour avec PSWindowsUpdate
            $history = Get-WUHistory | Where-Object { $_.Operation -eq 'Installation' -and $_.Result -eq 'Succeeded' }
            
            $normalizedHistory = $history | ForEach-Object {
                $kbMatch = $null
                if ($_.Title -match 'KB(\d+)') {
                    $kbMatch = "KB" + $matches[1]
                } elseif ($_.KB) {
                    $kbMatch = $_.KB
                } else {
                    $kbMatch = "N/A"
                }
                
                [PSCustomObject]@{
                    Title = if ($_.Title) { $_.Title.ToString() } else { "Mise à jour sans titre" }
                    Date = if ($_.Date) { $_.Date.ToString("yyyy-MM-ddTHH:mm:ss") } else { "N/A" }
                    Operation = if ($_.Operation) { $_.Operation.ToString() } else { "Installation" }
                    Result = if ($_.Result) { $_.Result.ToString() } else { "Succeeded" }
                    KB = $kbMatch
                    Size = if ($_.Size) { $_.Size.ToString() } else { "0" }
                    Description = if ($_.Description) { $_.Description.ToString() } else { $_.Title }
                }
            }
            
            $normalizedHistory | ConvertTo-Json -Compress
        } else {
            Write-Output "PSWindowsUpdate_NOT_AVAILABLE"
        }
    } catch {
        Write-Output "PSWindowsUpdate_ERROR: $($_.Exception.Message)"
    }
    "#;

    let pswindowsupdate_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", pswindowsupdate_command])
        .output()
        .await;

    let mut pswindowsupdate_success = false;

    if let Ok(output) = pswindowsupdate_output {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            if !output_str.contains("PSWindowsUpdate_NOT_AVAILABLE") && 
               !output_str.contains("PSWindowsUpdate_ERROR") &&
               !output_str.trim().is_empty() &&
               output_str.trim() != "null" {
                
                // Parser la sortie PSWindowsUpdate
                let parsed_updates: Result<Vec<WUHistoryUpdate>, _> = if output_str.trim().starts_with('[') {
                    serde_json::from_str(&output_str)
                } else {
                    serde_json::from_str::<WUHistoryUpdate>(&output_str)
                        .map(|update| vec![update])
                };

                match parsed_updates {
                    Ok(updates) => {
                        for wu_update in updates {
                            all_updates.push(InstalledUpdateInfo {
                                kb_id: wu_update.kb.unwrap_or_else(|| "N/A".to_string()),
                                description: wu_update.title.unwrap_or_else(|| wu_update.description.unwrap_or_else(|| "Mise à jour Windows".to_string())),
                                installed_by: "Windows Update".to_string(),
                                installed_on: wu_update.date.unwrap_or_else(|| "N/A".to_string()),
                            });
                        }
                        pswindowsupdate_success = true;
                        println!("Historique obtenu via PSWindowsUpdate: {} mises à jour", all_updates.len());
                    }
                    Err(e) => {
                        println!("Erreur parsing PSWindowsUpdate: {}", e);
                    }
                }
            }
        }
    }

    // Méthode 2: Fallback vers Win32_QuickFixEngineering pour les hotfixes classiques
    if !pswindowsupdate_success {
        println!("Fallback vers Win32_QuickFixEngineering...");
        
        let wmi_command = r#"
        try {
            $hotfixes = Get-WmiObject -Class Win32_QuickFixEngineering | Where-Object { $_.HotFixID -ne $null }
            
            $normalizedHotfixes = $hotfixes | ForEach-Object {
                $installedOn = "N/A"
                if ($_.InstalledOn) {
                    try {
                        $installedOn = ([DateTime]$_.InstalledOn).ToString("yyyy-MM-ddTHH:mm:ss")
                    } catch {
                        $installedOn = $_.InstalledOn.ToString()
                    }
                }
                
                [PSCustomObject]@{
                    HotFixID = $_.HotFixID
                    Description = if ($_.Description) { $_.Description } else { "Hotfix Windows" }
                    InstalledBy = if ($_.InstalledBy) { $_.InstalledBy } else { "Système" }
                    InstalledOn = $installedOn
                }
            }
            
            $normalizedHotfixes | ConvertTo-Json -Compress
        } catch {
            Write-Error $_.Exception.Message
            exit 1
        }
        "#;

        let wmi_output = app.shell()
            .command("powershell")
            .args(&["-ExecutionPolicy", "Bypass", "-Command", wmi_command])
            .output()
            .await
            .map_err(|e| format!("Erreur lors de l'exécution de Get-WmiObject: {}", e))?;

        if !wmi_output.status.success() {
            return Err(format!("Get-WmiObject a échoué: {:?} \nErreur: {}", wmi_output.status, String::from_utf8_lossy(&wmi_output.stderr)));
        }

        let updates_json_str = String::from_utf8_lossy(&wmi_output.stdout);
        println!("JSON WMI reçu: {}", updates_json_str); // Debug

        if !updates_json_str.trim().is_empty() && updates_json_str.trim() != "null" {
            // Structure corrigée pour WMI avec mapping explicite des champs
            #[derive(Deserialize, Debug)]
            struct WmiQuickFix {
                #[serde(rename = "HotFixID")]
                hot_fix_id: String,
                #[serde(rename = "Description")]
                description: Option<String>,
                #[serde(rename = "InstalledBy")]
                installed_by: Option<String>,
                #[serde(rename = "InstalledOn")]
                installed_on: Option<String>,
            }

            let parsed_updates: Result<Vec<WmiQuickFix>, _> = if updates_json_str.trim().starts_with('[') {
                serde_json::from_str(&updates_json_str)
            } else {
                serde_json::from_str::<WmiQuickFix>(&updates_json_str)
                    .map(|update| vec![update])
            };

            match parsed_updates {
                Ok(wmi_updates) => {
                    for wmi_update in wmi_updates {
                        all_updates.push(InstalledUpdateInfo {
                            kb_id: wmi_update.hot_fix_id,
                            description: wmi_update.description.unwrap_or_else(|| "Hotfix Windows".to_string()),
                            installed_by: wmi_update.installed_by.unwrap_or_else(|| "Système".to_string()),
                            installed_on: wmi_update.installed_on.unwrap_or_else(|| "N/A".to_string()),
                        });
                    }
                    println!("Historique obtenu via WMI: {} hotfixes", all_updates.len());
                }
                Err(e) => {
                    println!("Erreur parsing JSON WMI: {} - JSON: {}", e, updates_json_str);
                    // Ne pas retourner d'erreur, continuer avec les autres méthodes
                }
            }
        }
    }

    // Méthode 3: Ajouter les mises à jour du registre Windows Update
    let registry_command = r#"
    try {
        $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\Results\Install"
        if (Test-Path $regPath) {
            $regData = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
            if ($regData) {
                $lastSuccess = $regData.LastSuccessTime
                if ($lastSuccess) {
                    [PSCustomObject]@{
                        HotFixID = "REG-LastInstall"
                        Description = "Dernière installation Windows Update"
                        InstalledBy = "Windows Update Service"
                        InstalledOn = $lastSuccess
                    } | ConvertTo-Json -Compress
                }
            }
        }
    } catch {
        Write-Output ""
    }
    "#;

    let registry_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", registry_command])
        .output()
        .await;

    if let Ok(output) = registry_output {
        if output.status.success() {
            let reg_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !reg_str.is_empty() && reg_str != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct RegUpdate {
                    hot_fix_id: String,
                    description: String,
                    installed_by: String,
                    installed_on: String,
                }

                if let Ok(reg_update) = serde_json::from_str::<RegUpdate>(&reg_str) {
                    all_updates.push(InstalledUpdateInfo {
                        kb_id: reg_update.hot_fix_id,
                        description: reg_update.description,
                        installed_by: reg_update.installed_by,
                        installed_on: reg_update.installed_on,
                    });
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Méthode 4 : lecture du journal d'événements Windows Update Client
    // ─────────────────────────────────────────────────────────────────────────────
    let evtx_command = r#"
    try {
        $events = Get-WinEvent -LogName 'Microsoft-Windows-WindowsUpdateClient/Operational' -MaxEvents 300 |
                  Where-Object { $_.Id -in 19,44,46 }   # 19 = install OK, 44/46 = début / succès

        $normalized = $events | ForEach-Object {
            $kb = ""
            if ($_.Message -match 'KB\d+') { $kb = $matches[0] }

            [PSCustomObject]@{
                HotFixID    = if ($kb) { $kb } else { 'EVT-' + $_.Id }
                Description = ($_.Message -replace '\s+', ' ').Trim()
                InstalledBy = 'Windows Update Client'
                InstalledOn = $_.TimeCreated.ToString('yyyy-MM-ddTHH:mm:ss')
            }
        }

        $normalized | ConvertTo-Json -Compress
    } catch {
        Write-Output ''
    }
    "#;

    let evtx_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", evtx_command])
        .output()
        .await;

    if let Ok(output) = evtx_output {
        if output.status.success() {
            let evtx_json = String::from_utf8_lossy(&output.stdout);
            if !evtx_json.trim().is_empty() && evtx_json.trim() != "null" {
                #[derive(Deserialize)]
                struct EventUpdate {
                    #[serde(rename = "HotFixID")]
                    hot_fix_id: String,
                    #[serde(rename = "Description")]
                    description: String,
                    #[serde(rename = "InstalledBy")]
                    installed_by: String,
                    #[serde(rename = "InstalledOn")]
                    installed_on: String,
                }

                let parsed_evt: Result<Vec<EventUpdate>, _> = if evtx_json.trim().starts_with('[') {
                    serde_json::from_str(&evtx_json)
                } else {
                    serde_json::from_str::<EventUpdate>(&evtx_json).map(|u| vec![u])
                };

                if let Ok(evt_updates) = parsed_evt {
                    for ev in &evt_updates {
                        all_updates.push(InstalledUpdateInfo {
                            kb_id: ev.hot_fix_id.clone(),
                            description: ev.description.clone(),
                            installed_by: ev.installed_by.clone(),
                            installed_on: ev.installed_on.clone(),
                        });
                    }
                    println!(
                        "Historique ajouté via Event Log : {} entrées",
                        evt_updates.len()
                    );
                }
            }
        }
    }

    // Trier par KB ID et supprimer les doublons
    all_updates.sort_by(|a, b| a.kb_id.cmp(&b.kb_id));
    all_updates.dedup_by(|a, b| a.kb_id == b.kb_id);

    println!("Historique final: {} mises à jour uniques", all_updates.len());
    Ok(all_updates)
}

// --- Nouvelle commande --- 
#[command]
pub async fn search_available_updates(app: AppHandle) -> Result<Vec<AvailableUpdateInfo>, String> {
    println!("Real: search_available_updates() called");

    // Vérifier d'abord si le module PSWindowsUpdate est disponible
    let module_check_cmd = "Get-Module -ListAvailable -Name PSWindowsUpdate | Select-Object -First 1";
    let module_check_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", module_check_cmd])
        .output()
        .await
        .map_err(|e| format!("Erreur vérification module: {}", e))?;
    
    let module_output_str = String::from_utf8_lossy(&module_check_output.stdout);
    if module_output_str.trim().is_empty() || module_output_str.contains("Cannot find") {
        return Err("Le module PowerShell 'PSWindowsUpdate' n'est pas installé. Cliquez sur 'Installer le module' pour l'installer automatiquement.".to_string());
    }

    // Essayer d'importer le module
    let import_cmd = "Import-Module PSWindowsUpdate -Force -ErrorAction Stop; Write-Output 'Module imported successfully'";
    let import_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", import_cmd])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'import: {}", e))?;
    
    if !import_output.status.success() {
        let error_msg = String::from_utf8_lossy(&import_output.stderr);
        return Err(format!("Impossible d'importer le module PSWindowsUpdate. Erreur: {}", error_msg));
    }

    let mut all_updates = Vec::new();
    
    // Commande PowerShell améliorée pour normaliser les données
    let command = r#"
    $ProgressPreference = 'SilentlyContinue'
    try {
        $updates = Get-WindowsUpdate -MicrosoftUpdate -ErrorAction Stop | Where-Object { $_.IsInstalled -eq $false }
        
        # Normaliser les données avant conversion JSON
        $normalizedUpdates = $updates | ForEach-Object {
            $sizeBytes = 0
            if ($_.Size -ne $null) {
                if ($_.Size -is [string]) {
                    # Traiter les tailles sous forme de chaîne
                    $sizeStr = $_.Size.ToString().ToUpper()
                    if ($sizeStr -match "(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|BYTES?)") {
                        $number = [double]$matches[1]
                        $unit = $matches[2]
                        switch ($unit) {
                            "KB" { $sizeBytes = [long]($number * 1024) }
                            "MB" { $sizeBytes = [long]($number * 1024 * 1024) }
                            "GB" { $sizeBytes = [long]($number * 1024 * 1024 * 1024) }
                            "TB" { $sizeBytes = [long]($number * 1024 * 1024 * 1024 * 1024) }
                            default { $sizeBytes = [long]$number }
                        }
                    } else {
                        $sizeBytes = 0
                    }
                } else {
                    $sizeBytes = [long]$_.Size
                }
            }
            
            [PSCustomObject]@{
                Title = if ($_.Title) { $_.Title.ToString() } else { "" }
                KB = if ($_.KB) { $_.KB.ToString() } else { "" }
                Size = $sizeBytes
                IsDownloaded = [bool]$_.IsDownloaded
                IsInstalled = [bool]$_.IsInstalled
            }
        }
        
        $normalizedUpdates | ConvertTo-Json -Compress
    } catch {
        Write-Error $_.Exception.Message
        exit 1
    }
    "#;
    
    let output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-WindowsUpdate: {}", e))?;

    if output.status.success() {
        let updates_json_str = String::from_utf8_lossy(&output.stdout);
        println!("JSON reçu: {}", updates_json_str); // Debug
        
        if !updates_json_str.trim().is_empty() && updates_json_str.trim() != "null" {
            let parsed_updates: Result<Vec<PsAvailableUpdate>, _> = if updates_json_str.trim().starts_with('[') {
                serde_json::from_str(&updates_json_str)
            } else {
                serde_json::from_str::<PsAvailableUpdate>(&updates_json_str)
                    .map(|update| vec![update])
            };

            match parsed_updates {
                Ok(updates) => {
                    for ps_update in updates {
                        if ps_update.title.is_some() || ps_update.kb.is_some() {
                            all_updates.push(AvailableUpdateInfo {
                                title: ps_update.title.unwrap_or_else(|| "Mise à jour sans titre".to_string()),
                                kb_id: ps_update.kb.unwrap_or_else(|| "N/A".to_string()),
                                size: ps_update.size.unwrap_or(0),
                                is_downloaded: ps_update.is_downloaded.unwrap_or(false),
                                is_installed: false,
                            });
                        }
                    }
                }
                Err(e) => {
                    println!("Erreur parsing JSON: {} - JSON: {}", e, updates_json_str);
                    // Ne pas retourner d'erreur, juste logger et continuer
                }
            }
        }
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        if !error_msg.is_empty() {
            println!("Erreur Get-WindowsUpdate: {}", error_msg);
        }
    }
    
    // Vérification spécifique pour Microsoft Defender avec méthode plus robuste
    let defender_cmd = r#"
    try {
        $defender = Get-MpComputerStatus -ErrorAction Stop
        if ($defender) {
            $lastUpdate = $defender.AntivirusSignatureLastUpdated
            $currentVersion = $defender.AntispywareSignatureVersion
            
            # Vérifier si une mise à jour est nécessaire (plus de 1 jour)
            $needsUpdate = $false
            if ($lastUpdate) {
                $needsUpdate = $lastUpdate -lt (Get-Date).AddDays(-1)
            } else {
                $needsUpdate = $true
            }
            
            if ($needsUpdate) {
                $defenderUpdate = @{
                    Title = "Security Intelligence Update for Microsoft Defender Antivirus - KB2267602"
                    KB = "KB2267602"
                    Size = 15728640
                    IsDownloaded = $false
                    IsInstalled = $false
                }
                ConvertTo-Json -InputObject $defenderUpdate -Compress
            } else {
                Write-Output ""
            }
        }
    } catch {
        Write-Output ""
    }
    "#;
    
    let defender_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", defender_cmd])
        .output()
        .await;
        
    if let Ok(output) = defender_output {
        if output.status.success() {
            let defender_json = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !defender_json.is_empty() && defender_json != "null" {
                if let Ok(defender_update) = serde_json::from_str::<PsAvailableUpdate>(&defender_json) {
                    if defender_update.title.is_some() {
                        all_updates.push(AvailableUpdateInfo {
                            title: defender_update.title.unwrap(),
                            kb_id: defender_update.kb.unwrap_or_else(|| "KB2267602".to_string()),
                            size: defender_update.size.unwrap_or(15728640),
                            is_downloaded: defender_update.is_downloaded.unwrap_or(false),
                            is_installed: false,
                        });
                    }
                }
            }
        }
    }

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

#[command]
pub async fn install_pswindowsupdate_module(app: AppHandle) -> Result<String, String> {
    println!("Installation du module PSWindowsUpdate...");
    
    // D'abord, vérifier si le module est déjà installé
    let check_command = "Get-Module -ListAvailable -Name PSWindowsUpdate | Select-Object -First 1 | ConvertTo-Json";
    let check_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", check_command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de la vérification du module: {}", e))?;
    
    let module_exists = !String::from_utf8_lossy(&check_output.stdout).trim().is_empty() && 
                       !String::from_utf8_lossy(&check_output.stdout).contains("null");
    
    if module_exists {
        return Ok("Le module PSWindowsUpdate est déjà installé.".to_string());
    }
    
    // Installer le module avec plusieurs méthodes de fallback
    let install_commands = vec![
        // Méthode 1: Installation normale avec CurrentUser
        "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; Install-Module -Name PSWindowsUpdate -Force -Scope CurrentUser -AllowClobber",
        // Méthode 2: Installation avec TrustReposiory
        "Set-PSRepository -Name PSGallery -InstallationPolicy Trusted; Install-Module -Name PSWindowsUpdate -Force -Scope CurrentUser -AllowClobber",
        // Méthode 3: Installation directe depuis PowerShell Gallery
        "Install-PackageProvider -Name NuGet -Force -Scope CurrentUser; Install-Module -Name PSWindowsUpdate -Force -Scope CurrentUser -AllowClobber"
    ];
    
    for (i, command) in install_commands.iter().enumerate() {
        println!("Tentative d'installation {} avec la méthode {}", i + 1, i + 1);
        
        let output = app.shell()
            .command("powershell")
            .args(&["-ExecutionPolicy", "Bypass", "-Command", command])
            .output()
            .await;
            
        match output {
            Ok(result) if result.status.success() => {
                // Vérifier que l'installation a réussi
                let verify_output = app.shell()
                    .command("powershell")
                    .args(&["-ExecutionPolicy", "Bypass", "-Command", check_command])
                    .output()
                    .await;
                    
                if let Ok(verify) = verify_output {
                    if !String::from_utf8_lossy(&verify.stdout).trim().is_empty() && 
                       !String::from_utf8_lossy(&verify.stdout).contains("null") {
                        return Ok(format!("Module PSWindowsUpdate installé avec succès (méthode {}).", i + 1));
                    }
                }
            }
            Ok(result) => {
                println!("Méthode {} échouée: {}", i + 1, String::from_utf8_lossy(&result.stderr));
            }
            Err(e) => {
                println!("Erreur méthode {}: {}", i + 1, e);
            }
        }
    }
    
    Err("Impossible d'installer le module PSWindowsUpdate. Essayez d'exécuter l'application en tant qu'administrateur ou installez manuellement le module avec 'Install-Module PSWindowsUpdate' dans PowerShell.".to_string())
}

#[command]
pub async fn install_windows_updates(app: AppHandle) -> Result<String, String> {
    println!("Installation des mises à jour Windows...");
    
    // Vérifier que le module PSWindowsUpdate est disponible
    let check_cmd = "Get-Module -ListAvailable -Name PSWindowsUpdate | Select-Object -First 1";
    let check_output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", check_cmd])
        .output()
        .await;
        
    match check_output {
        Ok(output) if output.status.success() => {
            let module_output = String::from_utf8_lossy(&output.stdout);
            if module_output.trim().is_empty() {
                return Err("Le module PSWindowsUpdate n'est pas installé. Installez-le d'abord.".to_string());
            }
        }
        _ => {
            return Err("Impossible de vérifier la disponibilité du module PSWindowsUpdate.".to_string());
        }
    }
    
    let command = r#"
    $ProgressPreference = 'SilentlyContinue'
    try {
        Import-Module PSWindowsUpdate -Force -ErrorAction Stop
        $result = Install-WindowsUpdate -MicrosoftUpdate -AcceptAll -IgnoreReboot -Confirm:$false -ErrorAction Stop
        if ($result) {
            $result | Select-Object Title, Result, Size | ConvertTo-Json -Compress
        } else {
            Write-Output "Aucune mise à jour à installer ou installation terminée."
        }
    } catch {
        Write-Error $_.Exception.Message
        exit 1
    }
    "#;
    
    let output = app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'installation: {}", e))?;
    
    if output.status.success() {
        let result_str = String::from_utf8_lossy(&output.stdout);
        Ok(format!("Installation terminée:\n{}", result_str))
    } else {
        let error_str = String::from_utf8_lossy(&output.stderr);
        Err(format!("Échec de l'installation des mises à jour:\n{}", error_str))
    }
} 