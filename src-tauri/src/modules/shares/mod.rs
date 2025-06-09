use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsNetworkDrive {
    name: String,  // Lettre du lecteur (ex: "Z")
    #[serde(rename = "DisplayRoot")]
    display_root: Option<String>, // Chemin réseau (ex: "\\server\share")
    description: Option<String>,
    #[serde(rename = "Provider")]
    provider: Option<String>, // Microsoft Windows Network
    #[serde(rename = "Root")]
    root: Option<String>,
    #[serde(rename = "CurrentLocation")]
    current_location: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
pub struct ShareInfo {
    name: String,           // Lettre du lecteur (Z:)
    path: String,           // Chemin réseau (\\server\share)
    description: String,    // Description ou nom du serveur
    state: String,          // Online/Offline
    share_type: String,     // Network Drive
    current_users: u32,     // Toujours 1 si monté
}

// Helper pour convertir le code d'état en texte lisible
fn parse_share_state(state_code: u32) -> String {
    match state_code {
        0 => "Offline".to_string(),
        1 => "Online".to_string(),
        2 => "Paused".to_string(),
        _ => format!("État {}", state_code),
    }
}

// Helper pour convertir le type de partage en texte lisible
fn parse_share_type(type_code: u32) -> String {
    match type_code {
        0 => "Disk".to_string(),
        1 => "Print".to_string(),
        2 => "Device".to_string(),
        3 => "IPC".to_string(),
        _ => format!("Type {}", type_code),
    }
}

#[command]
pub async fn list_shares(app: AppHandle) -> Result<Vec<ShareInfo>, String> {
    println!("Real: list_shares() called - Recherche des lecteurs réseau mappés");
    
    let mut all_shares = Vec::new();
    
    // Méthode 1: Utiliser net use pour avoir la liste officielle des mappages
    println!("Méthode 1: Utilisation de 'net use'");
    let net_use_output = app.shell()
        .command("net")
        .args(&["use"])
        .output()
        .await;
    
    if let Ok(output) = net_use_output {
        if output.status.success() {
            let net_output = String::from_utf8_lossy(&output.stdout);
            println!("Sortie net use: {}", net_output);
            
            // Parser la sortie de net use
            for line in net_output.lines() {
                if line.contains("Microsoft Windows Network") && !line.contains("The command completed successfully") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        // Format typique: "OK           Z:        \\server\share     Microsoft Windows Network"
                        if let Some(drive_letter) = parts.iter().find(|part| part.ends_with(':')) {
                            if let Some(network_path) = parts.iter().find(|part| part.starts_with("\\\\")) {
                                all_shares.push(ShareInfo {
                                    name: drive_letter.to_string(),
                                    path: network_path.to_string(),
                                    description: format!("Lecteur réseau sur {}", 
                                        network_path.split('\\').nth(2).unwrap_or("serveur inconnu")),
                                    state: "Online".to_string(),
                                    share_type: "Network Drive".to_string(),
                                    current_users: 1,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 2: Utiliser WMI Win32_LogicalDisk pour les lecteurs réseau (DriveType = 4)
    println!("Méthode 2: Utilisation de Win32_LogicalDisk");
    let wmi_command = r#"
    Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DriveType -eq 4 } | Select-Object DeviceID, ProviderName, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress
    "#;
    
    let wmi_output = app.shell()
        .command("powershell")
        .args(&["-Command", wmi_command])
        .output()
        .await;
    
    if let Ok(output) = wmi_output {
        if output.status.success() {
            let wmi_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON WMI Win32_LogicalDisk: {}", wmi_json);
            
            if !wmi_json.trim().is_empty() && wmi_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct Win32LogicalDisk {
                    device_id: String,
                    provider_name: Option<String>,
                    volume_name: Option<String>,
                    size: Option<u64>,
                    free_space: Option<u64>,
                }
                
                let wmi_disks: Result<Vec<Win32LogicalDisk>, _> = if wmi_json.trim().starts_with('[') {
                    serde_json::from_str(&wmi_json)
                } else {
                    serde_json::from_str::<Win32LogicalDisk>(&wmi_json).map(|d| vec![d])
                };
                
                if let Ok(disks) = wmi_disks {
                    for disk in disks {
                        if let Some(provider_name) = disk.provider_name {
                            // Éviter les doublons
                            if !all_shares.iter().any(|s| s.name == disk.device_id) {
                                all_shares.push(ShareInfo {
                                    name: disk.device_id,
                                    path: provider_name.clone(),
                                    description: disk.volume_name.unwrap_or_else(|| {
                                        format!("Lecteur réseau sur {}", 
                                            provider_name.split('\\').nth(2).unwrap_or("serveur inconnu"))
                                    }),
                                    state: "Online".to_string(),
                                    share_type: "Network Drive".to_string(),
                                    current_users: 1,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 2b: Détecter spécifiquement les emplacements réseau visibles dans l'Explorateur
    println!("Méthode 2b: Détection des emplacements réseau de l'Explorateur");
    let explorer_network_command = r#"
    try {
        $networkDrives = @()
        
        # Vérifier tous les lecteurs Y: et Z: spécifiquement mentionnés dans l'image
        $driveLetters = @("Y", "Z", "X", "W", "V", "U", "T", "S", "R", "Q", "P", "O", "N", "M", "L", "K", "J", "I", "H", "G", "F")
        
        foreach ($letter in $driveLetters) {
            $drivePath = "${letter}:"
            if (Test-Path $drivePath) {
                try {
                    # Obtenir les informations sur le lecteur
                    $driveInfo = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$drivePath'"
                    $volume = Get-Volume -DriveLetter $letter -ErrorAction SilentlyContinue
                    
                    # Vérifier si c'est un lecteur réseau en testant l'accès réseau
                    $isNetwork = $false
                    $providerName = ""
                    $volumeName = ""
                    
                    if ($driveInfo) {
                        if ($driveInfo.DriveType -eq 4) {
                            $isNetwork = $true
                            $providerName = $driveInfo.ProviderName
                        } elseif ($driveInfo.DriveType -eq 3) {
                            # Même si DriveType=3, vérifier si c'est quand même un lecteur réseau
                            # Certains emplacements réseau apparaissent comme DriveType=3
                            $driveRoot = Get-Item $drivePath -Force -ErrorAction SilentlyContinue
                            if ($driveRoot -and $driveRoot.Target) {
                                foreach ($target in $driveRoot.Target) {
                                    if ($target.StartsWith("\\")) {
                                        $isNetwork = $true
                                        $providerName = $target
                                        break
                                    }
                                }
                            }
                            
                            # Autre vérification : essayer fsutil
                            try {
                                $fsutilResult = fsutil volume diskfree $drivePath 2>$null
                                if ($fsutilResult -and $fsutilResult.ToString().Contains("remote")) {
                                    $isNetwork = $true
                                }
                            } catch {}
                        }
                        
                        if ($volume) {
                            $volumeName = $volume.FileSystemLabel
                            if (-not $volumeName) { $volumeName = "" }
                        }
                        
                        # Si c'est un lecteur réseau, l'ajouter
                        if ($isNetwork) {
                            $freeSpace = if ($driveInfo.FreeSpace) { $driveInfo.FreeSpace } else { 0 }
                            $totalSize = if ($driveInfo.Size) { $driveInfo.Size } else { 0 }
                            
                            $networkDrives += [PSCustomObject]@{
                                DeviceID = $drivePath
                                ProviderName = $providerName
                                VolumeName = $volumeName
                                FreeSpace = $freeSpace
                                TotalSize = $totalSize
                                DriveType = $driveInfo.DriveType
                            }
                        }
                    }
                } catch {
                    # Ignorer les erreurs pour ce lecteur
                }
            }
        }
        
        $networkDrives | ConvertTo-Json -Compress
    } catch {
        Write-Output ""
    }
    "#;
    
    let explorer_network_output = app.shell()
        .command("powershell")
        .args(&["-Command", explorer_network_command])
        .output()
        .await;
    
    if let Ok(output) = explorer_network_output {
        if output.status.success() {
            let explorer_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON Emplacements réseau Explorateur: {}", explorer_json);
            
            if !explorer_json.trim().is_empty() && explorer_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct ExplorerNetworkDrive {
                    device_id: String,
                    provider_name: Option<String>,
                    volume_name: Option<String>,
                    free_space: Option<u64>,
                    total_size: Option<u64>,
                    drive_type: Option<u32>,
                }
                
                let explorer_drives: Result<Vec<ExplorerNetworkDrive>, _> = if explorer_json.trim().starts_with('[') {
                    serde_json::from_str(&explorer_json)
                } else {
                    serde_json::from_str::<ExplorerNetworkDrive>(&explorer_json).map(|d| vec![d])
                };
                
                if let Ok(drives) = explorer_drives {
                    for drive in drives {
                        let provider_name = drive.provider_name.unwrap_or_else(|| "Emplacement réseau".to_string());
                        let volume_name = drive.volume_name.unwrap_or_else(|| "".to_string());
                        
                        // Éviter les doublons
                        if !all_shares.iter().any(|s| s.name == drive.device_id) {
                            all_shares.push(ShareInfo {
                                name: drive.device_id.clone(),
                                path: provider_name.clone(),
                                description: if !volume_name.is_empty() {
                                    format!("{} sur {}", volume_name, 
                                        provider_name.split('\\').nth(2).unwrap_or("serveur réseau"))
                                } else {
                                    format!("Emplacement réseau {}", drive.device_id)
                                },
                                state: "Online".to_string(),
                                share_type: format!("Network Location (Type {})", drive.drive_type.unwrap_or(4)),
                                current_users: 1,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 3: Rechercher les emplacements réseau dans le registre
    println!("Méthode 3: Recherche des emplacements réseau dans le registre");
    let registry_command = r#"
    try {
        $networkPlaces = @()
        
        # Chercher dans les emplacements réseau de l'utilisateur actuel
        $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Desktop\NameSpace"
        if (Test-Path $regPath) {
            Get-ChildItem $regPath | ForEach-Object {
                $clsid = $_.PSChildName
                $clsidPath = "HKCR\CLSID\$clsid"
                if (Test-Path $clsidPath) {
                    $name = (Get-ItemProperty -Path $clsidPath -Name "(default)" -ErrorAction SilentlyContinue)."(default)"
                    if ($name -and $name.StartsWith("\\")) {
                        $networkPlaces += [PSCustomObject]@{
                            Name = "Réseau-$($networkPlaces.Count + 1)"
                            Path = $name
                            Type = "Network Location"
                        }
                    }
                }
            }
        }
        
        # Chercher dans les favoris réseau
        $favoritesPath = [Environment]::GetFolderPath("Favorites")
        if (Test-Path $favoritesPath) {
            Get-ChildItem -Path $favoritesPath -Recurse -Include "*.lnk" | ForEach-Object {
                try {
                    $shell = New-Object -ComObject WScript.Shell
                    $shortcut = $shell.CreateShortcut($_.FullName)
                    if ($shortcut.TargetPath.StartsWith("\\")) {
                        $networkPlaces += [PSCustomObject]@{
                            Name = $_.BaseName
                            Path = $shortcut.TargetPath
                            Type = "Network Shortcut"
                        }
                    }
                } catch {}
            }
        }
        
        $networkPlaces | ConvertTo-Json -Compress
    } catch {
        Write-Output ""
    }
    "#;
    
    let registry_output = app.shell()
        .command("powershell")
        .args(&["-Command", registry_command])
        .output()
        .await;
    
    if let Ok(output) = registry_output {
        if output.status.success() {
            let registry_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON Emplacements réseau: {}", registry_json);
            
            if !registry_json.trim().is_empty() && registry_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct NetworkPlace {
                    name: String,
                    path: String,
                    #[serde(rename = "Type")]
                    place_type: String,
                }
                
                let network_places: Result<Vec<NetworkPlace>, _> = if registry_json.trim().starts_with('[') {
                    serde_json::from_str(&registry_json)
                } else {
                    serde_json::from_str::<NetworkPlace>(&registry_json).map(|p| vec![p])
                };
                
                if let Ok(places) = network_places {
                    for place in places {
                        if !all_shares.iter().any(|s| s.path == place.path) {
                            all_shares.push(ShareInfo {
                                name: place.name,
                                path: place.path.clone(),
                                description: format!("Emplacement réseau sur {}", 
                                    place.path.split('\\').nth(2).unwrap_or("serveur inconnu")),
                                state: "Online".to_string(),
                                share_type: place.place_type,
                                current_users: 1,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 4: Rechercher dans l'historique récent de l'Explorateur
    println!("Méthode 4: Recherche dans l'historique de l'Explorateur");
    let recent_command = r#"
    try {
        $recentNetworks = @()
        
        # Chercher dans les emplacements récents
        $recentPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\TypedPaths"
        if (Test-Path $recentPath) {
            $props = Get-ItemProperty -Path $recentPath
            $props.PSObject.Properties | Where-Object { $_.Name -like "url*" } | ForEach-Object {
                if ($_.Value -and $_.Value.StartsWith("\\")) {
                    $recentNetworks += [PSCustomObject]@{
                        Name = "Récent-$($recentNetworks.Count + 1)"
                        Path = $_.Value
                        Type = "Recent Network"
                    }
                }
            }
        }
        
        # Chercher dans les dossiers récents du registre
        $mruPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\ComDlg32\OpenSavePidlMRU"
        if (Test-Path $mruPath) {
            Get-ChildItem $mruPath | ForEach-Object {
                try {
                    $props = Get-ItemProperty -Path $_.PSPath
                    $props.PSObject.Properties | Where-Object { $_.Name -match "^\d+$" } | ForEach-Object {
                        # Essayer de décoder les chemins réseau encodés
                        $value = $_.Value
                        if ($value -and $value.ToString().Contains("\\")) {
                            # Simplification : chercher des patterns de chemins réseau
                            $stringValue = [System.Text.Encoding]::Unicode.GetString($value) -replace '\x00', ''
                            if ($stringValue -match '\\\\[^\\]+\\[^\\]+') {
                                $networkPath = $matches[0]
                                if ($networkPath.Length -gt 5) {
                                    $recentNetworks += [PSCustomObject]@{
                                        Name = "Récent-MRU-$($recentNetworks.Count + 1)"
                                        Path = $networkPath
                                        Type = "Recent MRU"
                                    }
                                }
                            }
                        }
                    }
                } catch {}
            }
        }
        
        $recentNetworks | Sort-Object Path | Get-Unique -AsString | ConvertTo-Json -Compress
    } catch {
        Write-Output ""
    }
    "#;
    
    let recent_output = app.shell()
        .command("powershell")
        .args(&["-Command", recent_command])
        .output()
        .await;
    
    if let Ok(output) = recent_output {
        if output.status.success() {
            let recent_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON Emplacements récents: {}", recent_json);
            
            if !recent_json.trim().is_empty() && recent_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct RecentNetwork {
                    name: String,
                    path: String,
                    #[serde(rename = "Type")]
                    recent_type: String,
                }
                
                let recent_networks: Result<Vec<RecentNetwork>, _> = if recent_json.trim().starts_with('[') {
                    serde_json::from_str(&recent_json)
                } else {
                    serde_json::from_str::<RecentNetwork>(&recent_json).map(|r| vec![r])
                };
                
                if let Ok(recents) = recent_networks {
                    for recent in recents {
                        if !all_shares.iter().any(|s| s.path == recent.path) {
                            all_shares.push(ShareInfo {
                                name: recent.name,
                                path: recent.path.clone(),
                                description: format!("Emplacement récent sur {}", 
                                    recent.path.split('\\').nth(2).unwrap_or("serveur inconnu")),
                                state: "Recent".to_string(),
                                share_type: recent.recent_type,
                                current_users: 0,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 5: Rechercher les connexions réseau dans le "Voisinage réseau"
    println!("Méthode 5: Recherche du voisinage réseau");
    let network_neighborhood_command = r#"
    try {
        $networkComputers = @()
        
        # Utiliser net view pour lister les ordinateurs du réseau
        $netViewOutput = net view 2>$null
        if ($netViewOutput) {
            $netViewOutput | ForEach-Object {
                if ($_ -match '^\\\\([^\s]+)\s+(.*)$') {
                    $computerName = $matches[1]
                    $description = $matches[2].Trim()
                    $networkComputers += [PSCustomObject]@{
                        Name = "\\$computerName"
                        Path = "\\$computerName"
                        Type = "Network Computer"
                        Description = $description
                    }
                }
            }
        }
        
        $networkComputers | ConvertTo-Json -Compress
    } catch {
        Write-Output ""
    }
    "#;
    
    let network_output = app.shell()
        .command("powershell")
        .args(&["-Command", network_neighborhood_command])
        .output()
        .await;
    
    if let Ok(output) = network_output {
        if output.status.success() {
            let network_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON Voisinage réseau: {}", network_json);
            
            if !network_json.trim().is_empty() && network_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct NetworkComputer {
                    name: String,
                    path: String,
                    #[serde(rename = "Type")]
                    computer_type: String,
                    description: Option<String>,
                }
                
                let network_computers: Result<Vec<NetworkComputer>, _> = if network_json.trim().starts_with('[') {
                    serde_json::from_str(&network_json)
                } else {
                    serde_json::from_str::<NetworkComputer>(&network_json).map(|c| vec![c])
                };
                
                if let Ok(computers) = network_computers {
                    for computer in computers {
                        if !all_shares.iter().any(|s| s.path == computer.path) {
                            all_shares.push(ShareInfo {
                                name: computer.name,
                                path: computer.path.clone(),
                                description: computer.description.unwrap_or_else(|| "Ordinateur réseau".to_string()),
                                state: "Available".to_string(),
                                share_type: computer.computer_type,
                                current_users: 0,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 6: Rechercher les raccourcis réseau épinglés dans l'Explorateur
    println!("Méthode 6: Recherche des raccourcis épinglés dans l'Explorateur");
    let quick_access_command = r#"
    try {
        $quickAccessItems = @()
        
        # Chercher dans les raccourcis d'accès rapide
        $quickAccessPath = "$env:APPDATA\Microsoft\Windows\Recent\AutomaticDestinations"
        if (Test-Path $quickAccessPath) {
            # Les fichiers .automaticDestinations-ms contiennent les raccourcis d'accès rapide
            Get-ChildItem -Path $quickAccessPath -Filter "*.automaticDestinations-ms" | ForEach-Object {
                try {
                    # Essayer de lire les métadonnées du fichier
                    $shell = New-Object -ComObject Shell.Application
                    $folder = $shell.Namespace($_.Directory.FullName)
                    $file = $folder.ParseName($_.Name)
                    if ($file -and $file.Path -and $file.Path.StartsWith("\\")) {
                        $quickAccessItems += [PSCustomObject]@{
                            Name = "Accès-$($quickAccessItems.Count + 1)"
                            Path = $file.Path
                            Type = "Quick Access"
                        }
                    }
                } catch {}
            }
        }
        
        # Chercher dans les emplacements favoris du registre
        $pinnedPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Ribbon"
        if (Test-Path $pinnedPath) {
            Get-ChildItem -Path $pinnedPath -Recurse | ForEach-Object {
                try {
                    $props = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
                    if ($props) {
                        $props.PSObject.Properties | Where-Object { $_.Value -and $_.Value.ToString().StartsWith("\\") } | ForEach-Object {
                            $quickAccessItems += [PSCustomObject]@{
                                Name = "Épinglé-$($quickAccessItems.Count + 1)"
                                Path = $_.Value.ToString()
                                Type = "Pinned Location"
                            }
                        }
                    }
                } catch {}
            }
        }
        
        # Chercher dans les raccourcis du bureau pointant vers des ressources réseau
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        if (Test-Path $desktopPath) {
            Get-ChildItem -Path $desktopPath -Filter "*.lnk" | ForEach-Object {
                try {
                    $shell = New-Object -ComObject WScript.Shell
                    $shortcut = $shell.CreateShortcut($_.FullName)
                    if ($shortcut.TargetPath -and $shortcut.TargetPath.StartsWith("\\")) {
                        $quickAccessItems += [PSCustomObject]@{
                            Name = $_.BaseName
                            Path = $shortcut.TargetPath
                            Type = "Desktop Shortcut"
                        }
                    }
                } catch {}
            }
        }
        
        $quickAccessItems | ConvertTo-Json -Compress
    } catch {
        Write-Output ""
    }
    "#;
    
    let quick_access_output = app.shell()
        .command("powershell")
        .args(&["-Command", quick_access_command])
        .output()
        .await;
    
    if let Ok(output) = quick_access_output {
        if output.status.success() {
            let quick_access_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON Raccourcis épinglés: {}", quick_access_json);
            
            if !quick_access_json.trim().is_empty() && quick_access_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct QuickAccessItem {
                    name: String,
                    path: String,
                    #[serde(rename = "Type")]
                    item_type: String,
                }
                
                let quick_access_items: Result<Vec<QuickAccessItem>, _> = if quick_access_json.trim().starts_with('[') {
                    serde_json::from_str(&quick_access_json)
                } else {
                    serde_json::from_str::<QuickAccessItem>(&quick_access_json).map(|q| vec![q])
                };
                
                if let Ok(items) = quick_access_items {
                    for item in items {
                        if !all_shares.iter().any(|s| s.path == item.path) {
                            all_shares.push(ShareInfo {
                                name: item.name,
                                path: item.path.clone(),
                                description: format!("Raccourci réseau vers {}", 
                                    item.path.split('\\').nth(2).unwrap_or("serveur inconnu")),
                                state: "Shortcut".to_string(),
                                share_type: item.item_type,
                                current_users: 0,
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Méthode 7: Examiner directement l'historique de navigation de l'Explorateur
    println!("Méthode 7: Historique de navigation de l'Explorateur");
    let explorer_history_command = r#"
    try {
        $explorerHistory = @()
        
        # Chercher dans l'historique de l'Explorateur Windows
        $historyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\ComDlg32\LastVisitedPidlMRU"
        if (Test-Path $historyPath) {
            $props = Get-ItemProperty -Path $historyPath -ErrorAction SilentlyContinue
            if ($props) {
                $props.PSObject.Properties | Where-Object { $_.Name -match "^\d+$" } | ForEach-Object {
                    try {
                        # Essayer de décoder les données binaires
                        $value = $_.Value
                        if ($value) {
                            $stringData = [System.Text.Encoding]::Unicode.GetString($value) -replace '\x00', ''
                            if ($stringData -match '\\\\[^\\]+\\[^\\]+') {
                                $networkPath = $matches[0]
                                $explorerHistory += [PSCustomObject]@{
                                    Name = "Historique-$($explorerHistory.Count + 1)"
                                    Path = $networkPath
                                    Type = "Explorer History"
                                }
                            }
                        }
                    } catch {}
                }
            }
        }
        
        # Chercher aussi dans StreamMRU
        $streamPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\ComDlg32\OpenSavePidlMRU\*"
        Get-Item $streamPath -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $props = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
                if ($props) {
                    $props.PSObject.Properties | Where-Object { $_.Name -match "^\d+$" } | ForEach-Object {
                        try {
                            $value = $_.Value
                            if ($value) {
                                $stringData = [System.Text.Encoding]::Unicode.GetString($value) -replace '\x00', ''
                                if ($stringData -match '\\\\[^\\]+\\[^\\]+') {
                                    $networkPath = $matches[0]
                                    if ($networkPath.Length -gt 5) {
                                        $explorerHistory += [PSCustomObject]@{
                                            Name = "Stream-$($explorerHistory.Count + 1)"
                                            Path = $networkPath
                                            Type = "Explorer Stream"
                                        }
                                    }
                                }
                            }
                        } catch {}
                    }
                }
            } catch {}
        }
        
        $explorerHistory | Sort-Object Path | Get-Unique -AsString | ConvertTo-Json -Compress
    } catch {
        Write-Output ""
    }
    "#;
    
    let explorer_history_output = app.shell()
        .command("powershell")
        .args(&["-Command", explorer_history_command])
        .output()
        .await;
    
    if let Ok(output) = explorer_history_output {
        if output.status.success() {
            let history_json = String::from_utf8_lossy(&output.stdout);
            println!("JSON Historique Explorateur: {}", history_json);
            
            if !history_json.trim().is_empty() && history_json.trim() != "null" {
                #[derive(Deserialize, Debug)]
                #[serde(rename_all = "PascalCase")]
                struct ExplorerHistoryItem {
                    name: String,
                    path: String,
                    #[serde(rename = "Type")]
                    history_type: String,
                }
                
                let history_items: Result<Vec<ExplorerHistoryItem>, _> = if history_json.trim().starts_with('[') {
                    serde_json::from_str(&history_json)
                } else {
                    serde_json::from_str::<ExplorerHistoryItem>(&history_json).map(|h| vec![h])
                };
                
                if let Ok(items) = history_items {
                    for item in items {
                        if !all_shares.iter().any(|s| s.path == item.path) {
                            all_shares.push(ShareInfo {
                                name: item.name,
                                path: item.path.clone(),
                                description: format!("Historique de navigation vers {}", 
                                    item.path.split('\\').nth(2).unwrap_or("serveur inconnu")),
                                state: "Historical".to_string(),
                                share_type: item.history_type,
                                current_users: 0,
                            });
                        }
                    }
                }
            }
        }
    }
    
    println!("Total des ressources réseau trouvées: {} éléments", all_shares.len());
    for share in &all_shares {
        println!("  - {} : {} ({}) - Type: {}", 
            share.name, share.path, share.description, share.share_type);
    }
    
    Ok(all_shares)
}

#[command]
pub async fn create_share(app: AppHandle, name: String, path: String, description: Option<String>) -> Result<(), String> {
    println!("Real: create_share() called - mapper lecteur '{}' vers '{}'", name, path);
    
    // Valider la lettre de lecteur (doit être une lettre suivie de :)
    if !name.ends_with(':') || name.len() != 2 {
        return Err("La lettre de lecteur doit être au format 'Z:' par exemple".to_string());
    }
    
    // Valider le chemin UNC (doit commencer par \\)
    if !path.starts_with("\\\\") {
        return Err("Le chemin doit être un chemin UNC (commençant par \\\\serveur\\partage)".to_string());
    }
    
    // Vérifier que la lettre n'est pas déjà utilisée
    let check_cmd = format!("Get-PSDrive -Name \"{}\" -ErrorAction SilentlyContinue", &name[0..1]);
    let check_output = app.shell()
        .command("powershell")
        .args(&["-Command", &check_cmd])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de la vérification du lecteur: {}", e))?;
    
    if !check_output.stdout.is_empty() {
        return Err(format!("La lettre de lecteur '{}' est déjà utilisée", name));
    }
    
    // Mapper le lecteur réseau avec net use
    let command = format!("net use {} \"{}\" /persistent:yes", name, path);
    println!("Commande mapping lecteur: {}", command);
    
    let output = app.shell()
        .command("cmd")
        .args(&["/c", &command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de net use: {}", e))?;
    
    if !output.status.success() { 
        let error_msg = String::from_utf8_lossy(&output.stderr);
        println!("net use a échoué - Erreur: {}", error_msg);
        return Err(format!("Échec du mapping du lecteur: {}", error_msg));
    }
    
    println!("Lecteur '{}' mappé avec succès vers '{}'", name, path);
    Ok(())
}

#[command]
pub async fn delete_share(app: AppHandle, name: String) -> Result<(), String> {
    println!("Real: delete_share() called - déconnecter lecteur '{}'", name);
    
    // Vérifier que le lecteur existe
    let check_cmd = format!("Get-PSDrive -Name \"{}\" -ErrorAction SilentlyContinue", &name[0..1]);
    let check_output = app.shell()
        .command("powershell")
        .args(&["-Command", &check_cmd])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de la vérification du lecteur: {}", e))?;
    
    if check_output.stdout.is_empty() {
        return Err(format!("Le lecteur '{}' n'existe pas", name));
    }
    
    // Déconnecter le lecteur réseau avec net use
    let command = format!("net use {} /delete /y", name);
    println!("Commande déconnexion lecteur: {}", command);
    
    let output = app.shell()
        .command("cmd")
        .args(&["/c", &command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de net use delete: {}", e))?;
    
    if !output.status.success() { 
        let error_msg = String::from_utf8_lossy(&output.stderr);
        println!("net use delete a échoué - Erreur: {}", error_msg);
        return Err(format!("Échec de la déconnexion du lecteur: {}", error_msg));
    }
    
    println!("Lecteur '{}' déconnecté avec succès", name);
    Ok(())
} 