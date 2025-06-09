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

// ─── STRUCT WMI GPU (corrigée) ─────────────────
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsVideoController {
    name: Option<String>,
    adapter_ram: Option<u64>,         // octets
    driver_version: Option<String>,
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

// ────────────────────────────────────────────────
//  Clés possibles dans le rapport DxDiag (EN + FR)
// ────────────────────────────────────────────────
const NAME_KEYS: &[&str] = &[
    "Card name",
    "Nom de la carte",
    "Nom du périphérique",
];

const MEM_KEYS: &[&str] = &[
    "Dedicated Memory",
    "Mémoire dédiée",
    "Mémoire vidéo dédiée",
    "Approx. Total Memory",
    "Mémoire totale approximative",
];

const DRV_KEYS: &[&str] = &[
    "Driver Version",
    "Version du pilote",
];
// ────────────────────────────────────────────────

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
        get_gpu_dxdiag(&app) // Nouvelle fonction pour GPU avec une commande PowerShell plus complète
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
    
    // 1) dxdiag
    let mut gpus = gpu_res.unwrap_or_else(|_| vec![]);
    // 2) si vide -> fallback WMI
    if gpus.is_empty() {
        gpus = get_gpu_wmi(&app).await;
    }
    info.gpus = gpus;

    Ok(info)
}

// ─── Récupération via dxdiag (corrigée) ─────────
async fn get_gpu_dxdiag(app: &AppHandle) -> Result<Vec<GpuInfo>, String> {
    // script PS : -Raw => une seule chaîne, puis split pour obtenir un tableau
    let ps = r#"
      $tmp = Join-Path $env:TEMP ("dx_{0}.txt" -f ([guid]::NewGuid().ToString("N")))
      dxdiag /whql:off /t "$tmp" | Out-Null
      while (-not (Test-Path $tmp)) { Start-Sleep -Milliseconds 200 }
      ($content = Get-Content -Path "$tmp" -Raw) | Out-Null
      $content -split "`r`n" | ConvertTo-Json -Compress
    "#;

    let out = app
        .shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", ps])
        .output()
        .await
        .map_err(|e| format!("dxdiag launch: {e}"))?;

    if !out.status.success() {
        return Err(format!(
            "dxdiag failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }

    let json = String::from_utf8_lossy(&out.stdout);
    if json.trim().is_empty() {
        return Ok(vec![]);
    }

    // Essayons d'abord en tant que tableau de chaînes
    let lines: Vec<String> = match serde_json::from_str(&json) {
        Ok(v) => v,
        Err(_) => {
            // parfois ConvertTo-Json renvoie un objet -> on l'ignore proprement
            println!("dxdiag JSON : format inattendu, aucun GPU extrait");
            return Ok(vec![]);
        }
    };

    let mut gpus = Vec::new();
    let mut current: HashMap<String, String> = HashMap::new();

    for l in lines {
        // nouvelle section "---------------"
        if l.starts_with("---------------") {
            if !current.is_empty() {
                push_gpu(&mut gpus, &current);
                current.clear();
            }
            continue;
        }

        // découpe clé : valeur
        if let Some((k, v)) = l.split_once(':') {
            let key   = k.trim().to_string();
            let value = v.trim().to_string();

            // si une nouvelle ligne « Nom de carte » arrive alors qu'un GPU est en cours
            if NAME_KEYS.contains(&key.as_str()) && !current.is_empty() {
                push_gpu(&mut gpus, &current);
                current.clear();
            }

            current.insert(key, value);
        }
    }

    // dernière carte
    if !current.is_empty() {
        push_gpu(&mut gpus, &current);
    }

    Ok(gpus)
}

fn first_val<'a>(map: &'a HashMap<String, String>, keys: &[&str]) -> Option<&'a String> {
    keys.iter().find_map(|k| map.get(*k))
}

fn push_gpu(list: &mut Vec<GpuInfo>, map: &HashMap<String, String>) {
    // nom
    if let Some(name) = first_val(map, NAME_KEYS) {
        // vram
        let ram_mb = first_val(map, MEM_KEYS)
            .and_then(|s| s.split_whitespace().next())
            .and_then(|n| n.replace([' ', ',', '.'], "").parse::<u64>().ok())
            .map(|mb| mb as f64)
            .unwrap_or(0.0);

        // pilote
        let drv = first_val(map, DRV_KEYS).cloned().unwrap_or_default();

        list.push(GpuInfo {
            name: name.clone(),
            ram_mb,
            driver_version: drv,
        });
    }
}

// ─────────────── NOUVEAU : fallback WMI pur ───────────────
async fn get_gpu_wmi(app: &AppHandle) -> Vec<GpuInfo> {
    let ps = r#"
      Get-CimInstance Win32_VideoController |
      Select-Object Name,AdapterRAM,DriverVersion |
      ConvertTo-Json -Compress
    "#;

    // On tente l'appel PowerShell ; en cas d'erreur on renvoie simplement un Vec vide
    let out = match app.shell()
        .command("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", ps])
        .output()
        .await
    {
        Ok(o) => o,
        Err(e) => {
            println!("Erreur GPU WMI : {e}");
            return vec![];
        }
    };

    let json = String::from_utf8_lossy(&out.stdout);
    if json.trim().is_empty() { return vec![] }

    let list: Result<Vec<PsVideoController>,_> = serde_json::from_str(&json);
    list.unwrap_or_default()
        .into_iter()
        .map(|g| GpuInfo{
            name: g.name.unwrap_or_else(||"GPU inconnu".into()),
            ram_mb: g.adapter_ram.map(|b| b as f64 / 1_048_576.0).unwrap_or(0.0),
            driver_version: g.driver_version.unwrap_or_default()
        })
        .collect()
}
// ----------------------------------------------------------- 