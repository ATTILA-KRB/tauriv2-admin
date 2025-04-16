use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value;
use std::collections::HashMap;

// --- Structures pour parser le JSON de PowerShell ---
// Note: Les noms de champs correspondent aux propriétés sélectionnées dans PowerShell

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")] // Correspondance avec la sortie PowerShell
struct PsNetAdapter {
    name: String,
    interface_description: String,
    mac_address: Option<String>, // Peut être null pour certains adaptateurs
    status: String, // Up, Down, etc.
    interface_index: u32,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsIpFullConfiguration {
    interface_index: u32,
    #[serde(rename = "IPAddress")]
    ip_addresses: Option<Vec<PsIpAddress>>,
    #[serde(rename = "DNSServer")]
    dns_servers: Option<Value>,
    gateway: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsIpAddress {
    ip_address: String,
    prefix_length: Option<u8>,
}

// --- Structure finale retournée au frontend ---

#[derive(Serialize, Debug, Clone)]
pub struct NetworkAdapterInfo {
    name: String,
    description: String,
    mac_address: String,
    status: String,
    ip_addresses: Vec<String>,
    dns_servers: Vec<String>,
    gateway: String,
}

#[command]
pub async fn list_network_adapters(app: AppHandle) -> Result<Vec<NetworkAdapterInfo>, String> {
    println!("Real (Optimized): list_network_adapters() called");

    // 1. Obtenir les adaptateurs
    let adapter_cmd = "Get-NetAdapter | Select-Object Name, InterfaceDescription, MacAddress, Status, InterfaceIndex | ConvertTo-Json -Depth 3 -Compress";
    let adapter_output = app.shell().command("powershell").args(&["-Command", adapter_cmd]).output().await
        .map_err(|e| format!("Erreur Get-NetAdapter: {}", e))?;
    if !adapter_output.status.success() {
        return Err(format!("Get-NetAdapter a échoué: {:?} \nErreur: {}", adapter_output.status, String::from_utf8_lossy(&adapter_output.stderr)));
    }
    let adapters_json_str = String::from_utf8_lossy(&adapter_output.stdout);
    
    // Vérifier si la réponse est un objet unique ou un tableau
    let parsed_adapters: Vec<PsNetAdapter> = if adapters_json_str.trim().starts_with('[') {
        // C'est déjà un tableau
        serde_json::from_str(&adapters_json_str)
            .map_err(|e| format!("Erreur parsing JSON adaptateurs: {}\nJSON: {}", e, adapters_json_str))?
    } else {
        // C'est un objet unique, le transformer en tableau
        let single_adapter: PsNetAdapter = serde_json::from_str(&adapters_json_str)
            .map_err(|e| format!("Erreur parsing JSON adaptateur unique: {}\nJSON: {}", e, adapters_json_str))?;
        vec![single_adapter]
    };

    // Commande améliorée pour les adresses IP - utiliser Get-NetIPAddress pour plus de détails
    let ip_cmd = r#"
    # Désactiver la journalisation détaillée (au lieu de l'activer)
    $VerbosePreference = 'SilentlyContinue'
    $DebugPreference = 'SilentlyContinue'
    
    $adapters = Get-NetAdapter | Select-Object -Property InterfaceIndex
    
    $allIps = @{}
    foreach ($adapter in $adapters) {
        $idx = $adapter.InterfaceIndex.ToString()
        $ipv4s = @()
        $ipv6s = @()
        
        # Utiliser Try/Catch pour éviter les erreurs si l'adaptateur n'a pas d'adresse IP
        try {
            $ips = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -ErrorAction Stop | Select-Object IPAddress, AddressFamily
            
            $ipv4s = @($ips | Where-Object { $_.AddressFamily -eq 'IPv4' } | ForEach-Object { $_.IPAddress })
            
            $ipv6s = @($ips | Where-Object { $_.AddressFamily -eq 'IPv6' } | ForEach-Object { $_.IPAddress })
        } catch {
            # Simplement ignorer l'erreur et continuer - cet adaptateur n'a pas d'adresses IP
        }
        
        # Utiliser des clés string pour le hashtable (important pour la sérialisation JSON)
        $allIps[$idx] = @{
            'IPv4' = $ipv4s;
            'IPv6' = $ipv6s
        }
    }
    
    # Convertir manuellement en format JSON valide
    $jsonResult = '{'
    $first = $true
    foreach ($key in $allIps.Keys) {
        if (-not $first) { $jsonResult += ',' }
        # Forcer des tableaux vides plutôt que null si aucune IP
        $ipv4Json = if ($allIps[$key]['IPv4'].Count -gt 0) { 
            ConvertTo-Json -InputObject $allIps[$key]['IPv4'] -Compress 
        } else { 
            "[]" 
        }
        
        $ipv6Json = if ($allIps[$key]['IPv6'].Count -gt 0) { 
            ConvertTo-Json -InputObject $allIps[$key]['IPv6'] -Compress 
        } else { 
            "[]" 
        }
        
        $jsonResult += "`"$key`": { `"IPv4`": $ipv4Json, `"IPv6`": $ipv6Json }"
        $first = $false
    }
    $jsonResult += '}'
    $jsonResult
    "#;

    let ip_output = app.shell().command("powershell").args(&["-Command", ip_cmd]).output().await
        .map_err(|e| format!("Erreur Get-NetIPAddress: {}", e))?;
    if !ip_output.status.success() {
        return Err(format!("Get-NetIPAddress a échoué: {:?} \nErreur: {}", ip_output.status, String::from_utf8_lossy(&ip_output.stderr)));
    }
    
    let ip_json_str = String::from_utf8_lossy(&ip_output.stdout);
    
    // Ajouté: nettoyage de la sortie pour éviter les problèmes de parsing
    // Prendre la dernière ligne non vide qui contient probablement le JSON
    let clean_json = ip_json_str.trim().lines()
        .filter(|line| !line.trim().is_empty())
        .last()
        .unwrap_or("");
    
    println!("IP JSON nettoyé: {}", clean_json); // Débogage
    println!("ERREUR IP (si présente): {}", String::from_utf8_lossy(&ip_output.stderr)); // Afficher les erreurs
    
    // Créer un HashMap des adresses IP par interface
    let ip_map: HashMap<String, Value> = serde_json::from_str(clean_json)
        .map_err(|e| format!("Erreur parsing JSON IPs: {}\nJSON: {}", e, clean_json))?;

    // 2. Obtenir TOUTES les configurations IP pour DNS et Gateway
    let ip_config_cmd = "Get-NetIPConfiguration | Select-Object InterfaceIndex, @{Name='DNSServer';Expression={$_.DNSServer.ServerAddresses}}, @{Name='Gateway';Expression={$_.IPv4DefaultGateway.NextHop}} | ConvertTo-Json -Depth 4 -Compress";
    let ip_config_output = app.shell().command("powershell").args(&["-Command", ip_config_cmd]).output().await
        .map_err(|e| format!("Erreur Get-NetIPConfiguration: {}", e))?;
    if !ip_config_output.status.success() {
        return Err(format!("Get-NetIPConfiguration a échoué: {:?} \nErreur: {}", ip_config_output.status, String::from_utf8_lossy(&ip_config_output.stderr)));
    }
    let ip_configs_json_str = String::from_utf8_lossy(&ip_config_output.stdout);
    
    // Vérifier si la réponse est un objet unique ou un tableau
    let parsed_ip_configs: Vec<PsIpFullConfiguration> = if ip_configs_json_str.trim().starts_with('[') {
        // C'est déjà un tableau
        serde_json::from_str(&ip_configs_json_str)
            .map_err(|e| format!("Erreur parsing JSON configs IP: {}\nJSON: {}", e, ip_configs_json_str))?
    } else {
        // C'est un objet unique, le transformer en tableau
        let single_config: PsIpFullConfiguration = serde_json::from_str(&ip_configs_json_str)
            .map_err(|e| format!("Erreur parsing JSON config IP unique: {}\nJSON: {}", e, ip_configs_json_str))?;
        vec![single_config]
    };

    // 3. Mettre les configs IP dans un HashMap
    let ip_config_map: HashMap<u32, PsIpFullConfiguration> = parsed_ip_configs.into_iter()
        .map(|config| (config.interface_index, config))
        .collect();

    // 4. Combiner les informations
    let mut final_adapters = Vec::new();
    for adapter in parsed_adapters {
        let mut ip_addresses = Vec::new();
        let mut dns_servers = Vec::new();
        let mut gateway = "N/A".to_string();

        // Adapter le status pour Bluetooth s'il est connecté mais marqué comme déconnecté
        let mut status = adapter.status.clone();
        if adapter.interface_description.to_lowercase().contains("bluetooth") {
            // Vérifier si le Bluetooth est actif même si PowerShell le marque comme "Disconnected"
            let bt_status_cmd = format!(
                "Get-PnpDevice | Where-Object {{ $_.FriendlyName -like '*Bluetooth*' -or $_.Class -eq 'Bluetooth' }} | Select-Object Status | ConvertTo-Json -Compress"
            );
            match app.shell().command("powershell").args(&["-Command", &bt_status_cmd]).output().await {
                Ok(output) => {
                    if output.status.success() {
                        let bt_json_str = String::from_utf8_lossy(&output.stdout);
                        // Vérifier si l'appareil Bluetooth est en fait "OK"
                        if bt_json_str.to_lowercase().contains("\"status\":\"ok\"") {
                            status = "Up".to_string(); // Forcer l'état à "Up" si l'appareil est OK
                            println!("Bluetooth trouvé, marqué comme Up (état réel) au lieu de {}", adapter.status);
                        }
                    }
                },
                Err(e) => println!("Erreur vérification état Bluetooth: {}", e)
            }
        }

        // Récupérer les adresses IP depuis notre nouvelle source
        if let Some(ip_value) = ip_map.get(&adapter.interface_index.to_string()) {
            // Essayer d'abord les IPv4
            if let Some(ipv4_array) = ip_value.get("IPv4").and_then(|v| v.as_array()) {
                for ip in ipv4_array {
                    if let Some(ip_str) = ip.as_str() {
                        if !ip_str.is_empty() {  // Vérifier que l'adresse IP n'est pas vide
                            ip_addresses.push(ip_str.to_string());
                        }
                    }
                }
            }
            
            // Ajouter les IPv6 si nécessaire
            if let Some(ipv6_array) = ip_value.get("IPv6").and_then(|v| v.as_array()) {
                for ip in ipv6_array {
                    if let Some(ip_str) = ip.as_str() {
                        // Ne pas ajouter les adresses de liaison locale IPv6 (fe80)
                        if !ip_str.is_empty() && !ip_str.starts_with("fe80") {
                            ip_addresses.push(ip_str.to_string());
                        }
                    }
                }
            }
        }

        // MÉTHODE DE SECOURS 1 : ancienne méthode pour les IPs si nécessaire
        if ip_addresses.is_empty() {
            if let Some(ip_config) = ip_config_map.get(&adapter.interface_index) {
                // Extraire IPs
                if let Some(ips) = &ip_config.ip_addresses {
                    for ip_addr_obj in ips {
                        ip_addresses.push(ip_addr_obj.ip_address.clone());
                    }
                }
            }
        }

        // MÉTHODE DE SECOURS 2 : Si toujours aucune IP, tenter avec une commande directe pour cet adaptateur
        if ip_addresses.is_empty() && adapter.status == "Up" {
            // Cette interface est active mais nous n'avons pas son IP, essayer une commande directe
            println!("Tentative de secours pour obtenir IP de l'interface {}: {}", adapter.interface_index, adapter.name);
            
            let fallback_cmd = format!(
                "Get-NetIPConfiguration -InterfaceIndex {} | Select-Object -ExpandProperty IPv4Address | Select-Object -ExpandProperty IPAddress",
                adapter.interface_index
            );
            
            match app.shell().command("powershell").args(&["-Command", &fallback_cmd]).output().await {
                Ok(output) => {
                    if output.status.success() {
                        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        if !stdout.is_empty() {
                            println!("IP trouvée via méthode de secours: {}", stdout);
                            ip_addresses.push(stdout);
                        }
                    }
                },
                Err(e) => println!("Erreur méthode de secours IP: {}", e)
            }
        }

        // MÉTHODE DE SECOURS 3 : Méthode ultime pour les interfaces actives avec passerelle
        if ip_addresses.is_empty() && adapter.status == "Up" {
            println!("Tentative de secours ultime pour obtenir IP de l'interface {}: {}", adapter.interface_index, adapter.name);
            
            // Récupérer uniquement les interfaces actives avec une passerelle par défaut
            let ultimate_cmd = r#"
            try {
                $activeConfig = Get-NetIPConfiguration | Where-Object { 
                    $_.InterfaceIndex -eq INTERFACE_INDEX -and
                    $_.IPv4DefaultGateway -ne $null -and 
                    $_.NetAdapter.Status -eq "Up" 
                } | Select-Object -First 1
                
                if ($activeConfig -ne $null -and $activeConfig.IPv4Address -ne $null) {
                    $activeConfig.IPv4Address.IPAddress
                } else {
                    ""
                }
            } catch {
                Write-Error "Erreur récupération IP secours: $_"
                ""
            }
            "#.replace("INTERFACE_INDEX", &adapter.interface_index.to_string());
            
            match app.shell().command("powershell").args(&["-Command", &ultimate_cmd]).output().await {
                Ok(output) => {
                    if output.status.success() {
                        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        if !stdout.is_empty() {
                            println!("IP trouvée via méthode de secours ultime: {}", stdout);
                            ip_addresses.push(stdout);
                        }
                    }
                },
                Err(e) => println!("Erreur méthode de secours ultime IP: {}", e)
            }
        }

        // Récupérer DNS et Gateway comme avant
        if let Some(ip_config) = ip_config_map.get(&adapter.interface_index) {
            // Extraire DNS (vérifier si Value est String ou Array)
            if let Some(dns_value) = &ip_config.dns_servers {
                if let Some(dns_array) = dns_value.as_array() {
                    // C'est un tableau de strings
                    dns_servers = dns_array.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                } else if let Some(dns_string) = dns_value.as_str() {
                    // C'est une string unique
                    if !dns_string.is_empty() {
                         dns_servers.push(dns_string.to_string());
                    }
                }
            }
            // Extraire Gateway (directement depuis le champ optionnel)
            if let Some(gw_str) = &ip_config.gateway {
                if !gw_str.is_empty() {
                    gateway = gw_str.clone();
                }
            }
        }

        final_adapters.push(NetworkAdapterInfo {
            name: adapter.name,
            description: adapter.interface_description,
            mac_address: adapter.mac_address.unwrap_or_else(|| "N/A".to_string()),
            status: status, // Utiliser le status modifié qui peut avoir été corrigé pour Bluetooth
            ip_addresses,
            dns_servers,
            gateway,
        });
    }

    Ok(final_adapters)
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn network_placeholder() -> Result<(), String> {
    println!("Placeholder: network command called");
    Err("Placeholder non utilisé".to_string())
}
*/ 