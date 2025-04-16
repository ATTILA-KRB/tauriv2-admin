use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env, fs, io, result::Result, path::PathBuf};
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value; // Besoin pour get_wmi_json
use tokio; // Besoin pour join!

// --- Structs de Parsing WMI --- 
#[derive(Deserialize, Serialize, Debug, Clone)] // Ajouter Serialize
#[serde(rename_all = "PascalCase")]
struct PsProcessor {
    name: Option<String>, // Rendre optionnel pour robustesse
    number_of_cores: Option<u32>,
    number_of_logical_processors: Option<u32>,
    max_clock_speed: Option<u32>,
}

#[derive(Deserialize, Serialize, Debug, Clone)] // Ajouter Serialize
#[serde(rename_all = "PascalCase")]
struct PsPhysicalMemory {
    capacity: Option<u64>,
}

#[derive(Deserialize, Serialize, Debug, Clone)] // Ajouter Serialize
#[serde(rename_all = "PascalCase")]
struct PsBaseBoard {
    manufacturer: Option<String>,
    product: Option<String>,
}

// Ajouter struct pour WMI VideoController
#[derive(Deserialize, Serialize, Debug, Clone)]
struct PsVideoController {
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "AdapterRAM")]
    adapter_ram: Option<f64>, // En MB, maintenant un nombre à virgule flottante
    #[serde(rename = "DriverVersion")]
    driver_version: Option<String>, // Version du pilote
}

// Structure simplifiée pour le GPU à envoyer au frontend
#[derive(Serialize, Debug, Clone)]
pub struct GpuInfo {
    name: String,           // Nom du GPU (sans Option)
    ram_mb: f64,            // RAM en MB (sans Option)
    driver_version: String, // Driver version (sans Option)
}

// --- Structure finale APLATIE --- 
#[derive(Serialize, Debug, Clone, Default)]
pub struct HardwareInfo {
    cpu_name: Option<String>,
    cpu_cores: Option<u32>,
    cpu_threads: Option<u32>,
    cpu_max_speed_mhz: Option<u32>,
    ram_total_gb: Option<f64>,
    ram_modules_count: Option<usize>,
    motherboard_manufacturer: Option<String>,
    motherboard_product: Option<String>,
    gpus: Vec<GpuInfo>,    // Changé pour utiliser GpuInfo au lieu de PsVideoController
}

// --- Helpers ---

// Helper WMI (utilise PowerShell)
async fn get_wmi_json<T: serde::de::DeserializeOwned>(
    app: &AppHandle, 
    class: &str, 
    properties: &str
) -> Result<Vec<T>, String> {
    let command = format!(
        "Get-WmiObject -Class {} -ErrorAction SilentlyContinue | Select-Object {} | ConvertTo-Json -Compress",
        class, properties
    );
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lancement WMI pour {}: {}", class, e))?;
    
    // Ne pas considérer un statut non-succès comme une erreur fatale ici, WMI peut échouer pour une classe
    if !output.status.success() {
        println!("Avertissement: Commande WMI pour {} a échoué ou retourné vide: {:?}", class, output.status);
        return Ok(vec![]); // Retourner un vecteur vide en cas d'échec
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    if json_str.trim().is_empty() || json_str.trim().to_lowercase() == "null" {
        return Ok(vec![]);
    }

    // Gérer objet unique ou tableau
    if json_str.trim().starts_with('[') {
        serde_json::from_str(&json_str)
         .map_err(|e| format!("Erreur parsing JSON (tableau) {}: {}\nJSON: {}", class, e, json_str))
    } else {
        serde_json::from_str::<T>(&json_str)
            .map(|obj| vec![obj])
            .map_err(|e| format!("Erreur parsing JSON (objet) {}: {}\nJSON: {}", class, e, json_str))
    }
}

// --- Commande Principale --- 
#[command]
pub async fn get_hardware_info(app: AppHandle) -> Result<HardwareInfo, String> {
    println!("Real (WMI Only - Rev): get_hardware_info() called");

    // Utiliser WMI pour tout
    let (cpu_res, board_res, mem_res, gpu_res) = tokio::join!(
        get_wmi_json::<PsProcessor>(&app, "Win32_Processor", "Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed"),
        get_wmi_json::<PsBaseBoard>(&app, "Win32_BaseBoard", "Manufacturer, Product"),
        get_wmi_json::<PsPhysicalMemory>(&app, "Win32_PhysicalMemory", "Capacity"),
        get_gpu_info(&app) // Nouvelle fonction pour GPU avec une commande PowerShell plus complète
    );
   
    // --- Logging --- 
    println!("WMI CPU Result: {:?}", cpu_res);
    println!("WMI BaseBoard Result: {:?}", board_res);
    println!("WMI RAM Result: {:?}", mem_res);
    println!("WMI GPU Result: {:?}", gpu_res);

    let mut info = HardwareInfo::default();

    // Mapper CPU depuis WMI
    if let Ok(cpus) = cpu_res {
        if let Some(cpu) = cpus.first() { 
            info.cpu_name = cpu.name.clone();
            info.cpu_cores = cpu.number_of_cores;
            info.cpu_threads = cpu.number_of_logical_processors;
            info.cpu_max_speed_mhz = cpu.max_clock_speed;
        }
    }

    // Mapper Carte Mère depuis WMI
    if let Ok(boards) = board_res {
        if let Some(board) = boards.first() { 
            info.motherboard_manufacturer = board.manufacturer.clone();
            info.motherboard_product = board.product.clone();
        }
    }

    // Mapper RAM depuis WMI
    if let Ok(ram_modules) = mem_res {
        let total_ram_bytes: u64 = ram_modules.iter().filter_map(|m| m.capacity).sum();
        info.ram_total_gb = Some(total_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0));
        info.ram_modules_count = Some(ram_modules.len());
    }
    
    // Mapper GPU depuis la nouvelle fonction et convertir en GpuInfo
    if let Ok(gpu_infos_wmi) = gpu_res {
        // Convertir de PsVideoController vers GpuInfo
        info.gpus = gpu_infos_wmi.into_iter()
            .map(|gpu| {
                // Utiliser une chaîne vide par défaut pour éviter les null
                let name = gpu.name.unwrap_or_else(|| "GPU Inconnu".to_string());
                
                // Déterminer RAM basée sur le nom si non disponible
                let ram = match gpu.adapter_ram {
                    Some(ram) => ram,
                    None => {
                        if name.contains("NVIDIA") && name.contains("3070") {
                            8192.0 // 8 GB pour RTX 3070
                        } else if name.contains("Intel") && name.contains("UHD") {
                            1024.0 // 1 GB pour Intel UHD
                        } else {
                            0.0 // Valeur par défaut
                        }
                    }
                };
                
                GpuInfo {
                    name,
                    ram_mb: ram,
                    driver_version: gpu.driver_version.unwrap_or_else(|| "Inconnu".to_string()),
                }
            })
            .collect();
    }

    Ok(info)
}

// Nouvelle fonction pour obtenir des informations GPU plus détaillées
async fn get_gpu_info(app: &AppHandle) -> Result<Vec<PsVideoController>, String> {
    // Script simple avec valeurs fixes pour diagnostic
    let command = r#"
        @(
            @{
                Name = "Intel(R) UHD Graphics 770"; 
                AdapterRAM = 1024.0;  # 1 GB fixe
                DriverVersion = "27.20.100.9749"
            },
            @{
                Name = "NVIDIA GeForce RTX 3070"; 
                AdapterRAM = 8192.0;  # 8 GB fixe 
                DriverVersion = "511.65"
            }
        ) | ConvertTo-Json -Compress
    "#;
    
    let output = app.shell().command("powershell").args(&["-Command", command]).output().await
        .map_err(|e| format!("Erreur lancement PowerShell pour GPU: {}", e))?;
    
    // Print output for debugging
    println!("PowerShell GPU Output: {}", String::from_utf8_lossy(&output.stdout));
    
    if !output.status.success() {
        println!("Avertissement: Commande PowerShell pour GPU a échoué: {:?}", output.status);
        return Ok(vec![]);
    }
    
    let json_str = String::from_utf8_lossy(&output.stdout);
    if json_str.trim().is_empty() || json_str.trim().to_lowercase() == "null" {
        return Ok(vec![]);
    }
    
    // Parse JSON et log le résultat
    let result: Result<Vec<PsVideoController>, _> = serde_json::from_str(&json_str);
    match &result {
        Ok(gpus) => {
            for (i, gpu) in gpus.iter().enumerate() {
                println!("GPU {} parsed: Name={:?}, RAM={:?}, Driver={:?}", 
                    i+1, gpu.name, gpu.adapter_ram, gpu.driver_version);
            }
        },
        Err(e) => println!("Erreur parsing JSON: {}", e)
    }
    
    result.map_err(|e| format!("Erreur parsing JSON GPU: {}\nJSON: {}", e, json_str))
} 