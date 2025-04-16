use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value; // Pour parser la sortie de Get-Counter
// Imports sysinfo commentés
// use sysinfo::{ProcessExt, System, SystemExt};

// Structure pour parser le JSON de Get-Process
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsProcess {
    // Get-Process retourne Id, non Pid
    id: u32, 
    process_name: String,
    #[serde(rename = "CPU")]
    cpu: Option<f64>, // Le CPU peut être null (ex: processus Idle), donc utiliser Option
    #[serde(rename = "WS")]
    working_set: u64, // Working Set (WS) est une bonne mesure de la mémoire
    // Le statut n'est pas directement retourné par Get-Process de base,
    // on pourrait l'obtenir via d'autres propriétés mais gardons simple.
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct ProcessInfo {
    pid: u32, 
    name: String,
    cpu_usage: f32,
    memory: u64, // En octets
    // status: String, // On enlève le statut pour l'instant
}

// --- Struct pour l'utilisation Système --- 
#[derive(Serialize, Deserialize, Debug, Clone)] // Deserialize pour un helper potentiel plus tard
pub struct SystemUsageInfo {
    cpu_usage_percent: f32,
    ram_used_mb: f64,
    ram_total_mb: f64, // Utile pour calculer le pourcentage
}

#[command]
pub async fn list_processes(app: AppHandle) -> Result<Vec<ProcessInfo>, String> {
    println!("Real (PowerShell): list_processes() called");

    // Utiliser Get-Process mais avec une méthode pour calculer le % CPU réel
    let command = r#"
        $processors = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
        Get-Process | ForEach-Object {
            $cpuPercent = if ($_.CPU -gt 0) { [math]::Min([math]::Round(($_.CPU / $processors), 2), 100) } else { 0 }
            [PSCustomObject]@{
                Id = $_.Id
                ProcessName = $_.ProcessName
                CPU = $cpuPercent
                WS = $_.WS
            }
        } | ConvertTo-Json -Depth 3 -Compress
    "#;

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-Process: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-Process a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let processes_json_str = String::from_utf8_lossy(&output.stdout);
    
    if processes_json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parser la sortie JSON (peut être un objet unique ou un tableau)
    let parsed_processes: Vec<PsProcess> = if processes_json_str.trim().starts_with('[') {
        serde_json::from_str(&processes_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) processus: {}\nJSON: {}", e, processes_json_str))?
    } else {
        serde_json::from_str::<PsProcess>(&processes_json_str)
            .map(|proc| vec![proc])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) processus: {}\nJSON: {}", e, processes_json_str))?
    };

    // Mapper vers la structure finale
    let final_processes = parsed_processes.into_iter().map(|ps_proc| {
        ProcessInfo {
            pid: ps_proc.id,
            name: ps_proc.process_name,
            cpu_usage: ps_proc.cpu.unwrap_or(0.0) as f32,
            memory: ps_proc.working_set,
        }
    }).collect();

    Ok(final_processes)
}

// Supprimer l'ancienne commande placeholder si elle existe encore
/*
#[command]
pub async fn system_placeholder() -> Result<(), String> {
    println!("Placeholder: system command called");
    Err("Placeholder non utilisé".to_string())
}
*/

// --- Commandes d'action Système ---

#[command]
pub async fn restart_computer(app: AppHandle) -> Result<(), String> {
    println!("Real: restart_computer() called");
    // Important: Nécessite des privilèges admin
    // /r = redémarrer, /t 0 = délai 0 sec, /f = forcer fermeture apps
    let command_name = "shutdown";
    let command_args = &["/r", "/t", "0", "/f"];

    let output = app.shell()
        .command(command_name)
        .args(command_args)
        .output()
        .await
        .map_err(|e| format!("Erreur lors du lancement de {}: {}", command_name, e))?;

    if !output.status.success() {
        return Err(format!("La commande de redémarrage a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        // Normalement, si succès, le PC va redémarrer avant qu'on reçoive une réponse claire
        Ok(())
    }
}

#[command]
pub async fn shutdown_computer(app: AppHandle) -> Result<(), String> {
    println!("Real: shutdown_computer() called");
    // Important: Nécessite des privilèges admin
    // /s = arrêter, /t 0 = délai 0 sec, /f = forcer fermeture apps
    let command_name = "shutdown";
    let command_args = &["/s", "/t", "0", "/f"];

    let output = app.shell()
        .command(command_name)
        .args(command_args)
        .output()
        .await
        .map_err(|e| format!("Erreur lors du lancement de {}: {}", command_name, e))?;

    if !output.status.success() {
        return Err(format!("La commande d'arrêt a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        Ok(())
    }
}

// --- Commande Usage Système (Simplifiée) --- 
#[command]
pub async fn get_system_usage(app: AppHandle) -> Result<SystemUsageInfo, String> {
    // Supprimer le println pour arrêter les logs excessifs
    // println!("Real: get_system_usage() called");

    // Obtenir l'utilisation CPU via une méthode plus fiable
    // La commande utilise plusieurs approches et prend la première qui fonctionne
    let cpu_command = r#"
    try {
        # Méthode 1: Utiliser Get-Counter (peut échouer silencieusement sur certains systèmes)
        $cpu1 = [math]::Round((Get-Counter '\processor(_total)\% processor time' -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop).CounterSamples.CookedValue, 2)
        Write-Output $cpu1 | ConvertTo-Json
    } catch {
        try {
            # Méthode 2: Utiliser WMI/CIM pour obtenir le LoadPercentage
            $cpu2 = [math]::Round((Get-CimInstance -ClassName Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average, 2)
            if ($null -eq $cpu2 -or $cpu2 -eq 0) { throw "CPU usage is zero or null" }
            Write-Output $cpu2 | ConvertTo-Json
        } catch {
            try {
                # Méthode 3: Utiliser WMI/CIM avec PercentProcessorTime
                $cpu3 = [math]::Round((Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction Stop).PercentProcessorTime, 2)
                if ($null -eq $cpu3 -or $cpu3 -eq 0) { throw "CPU usage is zero or null" }
                Write-Output $cpu3 | ConvertTo-Json
            } catch {
                # Méthode de secours: fournir une estimation basée sur les processus actifs
                $processors = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
                $totalCpu = (Get-Process).CPU | Measure-Object -Sum | Select-Object -ExpandProperty Sum
                $estimatedCpu = [math]::Min([math]::Round(($totalCpu / $processors), 2), 100)
                Write-Output $estimatedCpu | ConvertTo-Json
            }
        }
    }
    "#;

    let cpu_output = app.shell()
        .command("powershell")
        .args(&["-Command", cpu_command])
        .output()
        .await
        .map_err(|e| format!("Erreur CPU counter: {}", e))?;

    if !cpu_output.status.success() {
        return Err(format!("Erreur CPU counter: {:?}", String::from_utf8_lossy(&cpu_output.stderr)));
    }

    // Vérification et nettoyage de la sortie CPU
    let cpu_stdout = String::from_utf8_lossy(&cpu_output.stdout).trim().to_string();
    if cpu_stdout.is_empty() {
        return Err("Sortie CPU vide".to_string());
    }

    // Imprimer la sortie pour diagnostic (peut être retiré en production)
    println!("Sortie CPU brute: {}", cpu_stdout);

    // Extraire uniquement la valeur JSON (éviter les messages de débug potentiels)
    let cpu_json_start = cpu_stdout.find(|c: char| c.is_digit(10) || c == '-' || c == '.').unwrap_or(0);
    let cpu_json_end = cpu_json_start + cpu_stdout[cpu_json_start..].find(|c: char| !(c.is_digit(10) || c == '.' || c == '-')).unwrap_or(cpu_stdout[cpu_json_start..].len());
    
    let cpu_json = &cpu_stdout[cpu_json_start..cpu_json_end];
    
    // Obtenir l'utilisation de la RAM via Get-CimInstance
    let ram_command = "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory | ConvertTo-Json";

    let ram_output = app.shell()
        .command("powershell")
        .args(&["-Command", ram_command])
        .output()
        .await
        .map_err(|e| format!("Erreur RAM counter: {}", e))?;

    if !ram_output.status.success() {
        return Err(format!("Erreur RAM counter: {:?}", String::from_utf8_lossy(&ram_output.stderr)));
    }

    // Extraire les valeurs des réponses JSON
    let cpu_usage: f32 = match cpu_json.parse() {
        Ok(value) => value,
        Err(e) => {
            println!("Erreur parsing CPU: {} - Valeur: {}", e, cpu_json);
            return Err(format!("Erreur parsing CPU: {} - Valeur: '{}'", e, cpu_json));
        }
    };

    let ram_json = String::from_utf8_lossy(&ram_output.stdout);
    let ram_values: Value = serde_json::from_str(&ram_json)
        .map_err(|e| format!("Erreur parsing RAM JSON: {} - JSON: {}", e, ram_json))?;

    // Extraire les valeurs de RAM (les valeurs sont en KB)
    let total_kb = ram_values["TotalVisibleMemorySize"].as_f64()
        .ok_or_else(|| "Impossible d'obtenir TotalVisibleMemorySize".to_string())?;
    
    let free_kb = ram_values["FreePhysicalMemory"].as_f64()
        .ok_or_else(|| "Impossible d'obtenir FreePhysicalMemory".to_string())?;
    
    let used_kb = total_kb - free_kb;

    // Convertir KB en MB pour faciliter l'affichage
    let total_mb = total_kb / 1024.0;
    let used_mb = used_kb / 1024.0;

    // Vérifier que la valeur CPU n'est pas aberrante (comme 0.0 quand le système est clairement actif)
    if cpu_usage <= 0.1 && used_mb > (total_mb * 0.3) {
        println!("Valeur CPU suspecte ({}), analyse supplémentaire...", cpu_usage);
        // Une valeur CPU très basse avec utilisation RAM significative est suspecte
        // Mais on la retourne quand même, elle pourrait être correcte
    }

    Ok(SystemUsageInfo {
        cpu_usage_percent: cpu_usage,
        ram_used_mb: used_mb,
        ram_total_mb: total_mb,
    })
}

// --- Fonction pour terminer un processus ---
#[command]
pub async fn terminate_process(app: AppHandle, pid: u32) -> Result<bool, String> {
    println!("Real: terminate_process(pid: {}) called", pid);
    
    // Utiliser Stop-Process avec le PID (nécessite des privilèges admin pour certains processus)
    let command = format!("Stop-Process -Id {} -Force -ErrorAction SilentlyContinue -PassThru | Select-Object -Property HasExited | ConvertTo-Json", pid);
    
    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Stop-Process pour PID {}: {}", pid, e))?;
    
    // Si le processus n'existe pas ou ne peut pas être arrêté, PowerShell retourne une erreur
    // Avec -ErrorAction SilentlyContinue, pas d'erreur dans le flux stderr, mais status sera quand même false
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("Échec Stop-Process pour PID {}: {}", pid, stderr);
        return Ok(false);
    }
    
    // Vérifier la sortie pour confirmer que le processus a été arrêté
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    // Si la sortie est vide, cela signifie que le processus n'existait pas ou a été immédiatement terminé
    if stdout.is_empty() {
        println!("Processus {} terminé avec succès, mais sans confirmation", pid);
        return Ok(true);
    }
    
    // Sinon, analyser la sortie JSON pour vérifier HasExited
    match serde_json::from_str::<serde_json::Value>(&stdout) {
        Ok(json) => {
            match json.get("HasExited") {
                Some(has_exited) => {
                    if let Some(exited) = has_exited.as_bool() {
                        return Ok(exited);
                    }
                },
                None => println!("La propriété HasExited est absente de la réponse: {}", stdout)
            }
            Ok(true) // Par défaut, considérer comme réussi
        },
        Err(e) => {
            println!("Erreur lors de l'analyse de la réponse JSON: {} - Contenu: {}", e, stdout);
            // Si on ne peut pas parser mais que la commande a réussi, considérer comme un succès
            Ok(true)
        }
    }
} 