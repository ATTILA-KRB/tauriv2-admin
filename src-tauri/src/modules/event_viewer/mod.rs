use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value;

// Structure pour parser le JSON de Get-WinEvent
// Les noms de champs PowerShell peuvent varier légèrement, ajuster si besoin.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsWinEvent {
    #[serde(rename = "Id")]
    event_id: u32,
    #[serde(rename = "LevelDisplayName")]
    level: Option<String>,
    provider_name: String,
    #[serde(rename = "TimeCreated")]
    time_created: Option<Value>, // Gérer la date comme objet
    message: Option<String>,
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct EventLogEntry {
    event_id: u32,
    level: String,
    provider_name: String,
    time_created: String,
    message: String,
}

#[command]
pub async fn get_events(
    app: AppHandle, 
    log_name: String, 
    max_events: u32,
    // Nouveaux filtres optionnels
    level: Option<u8>,      // 1=Critical, 2=Error, 3=Warning, 4=Information, 5=Verbose
    provider_name_filter: Option<String>,
    event_id_filter: Option<i32>, // Peut être négatif pour exclure
    start_time: Option<String>, // Format ISO 8601 ou similaire attendu par PS
    end_time: Option<String>,
) -> Result<Vec<EventLogEntry>, String> {
    println!("Real: get_events(log: {}, max: {}, level: {:?}, provider: {:?}, id: {:?}, start: {:?}, end: {:?}) called", 
        log_name, max_events, level, provider_name_filter, event_id_filter, start_time, end_time);

    // Construire le filtre HashTable pour Get-WinEvent
    let mut filter_parts = Vec::new();
    filter_parts.push(format!("LogName='{}'", log_name));
    if let Some(lvl) = level {
        filter_parts.push(format!("Level={}", lvl));
    }
    if let Some(ref provider) = provider_name_filter {
        if !provider.trim().is_empty() {
             // Utiliser -like pour la flexibilité
            filter_parts.push(format!("ProviderName='*{}*'", provider.replace('"', "'"))); 
        }
    }
     if let Some(id) = event_id_filter {
        filter_parts.push(format!("Id={}", id)); // Get-WinEvent gère les ID négatifs pour exclusion
    }
     if let Some(ref start) = start_time {
        if !start.trim().is_empty() {
             filter_parts.push(format!("StartTime='{}'", start.replace('"', "'"))); 
        }
    }
     if let Some(ref end) = end_time {
         if !end.trim().is_empty() {
             filter_parts.push(format!("EndTime='{}'", end.replace('"', "'"))); 
         }
    }
    let filter_hashtable = format!("@{{{}}}", filter_parts.join("; "));

    // Construire la commande PowerShell
    // Pour le journal de sécurité, utiliser une approche différente car il requiert souvent des privilèges élevés
    let command = if log_name == "Security" {
        // Construire un hashtable de filtres spécifique pour le journal de sécurité
        let mut security_filter_parts = vec!["LogName='Security'".to_string()];
        
        // Ajouter les filtres supplémentaires si présents
        if let Some(lvl) = level {
            security_filter_parts.push(format!("Level={}", lvl));
        }
        if let Some(provider) = &provider_name_filter {
            if !provider.trim().is_empty() {
                security_filter_parts.push(format!("ProviderName='*{}*'", provider.replace('"', "'")));
            }
        }
        if let Some(id) = event_id_filter {
            security_filter_parts.push(format!("Id={}", id));
        }
        if let Some(start) = &start_time {
            if !start.trim().is_empty() {
                security_filter_parts.push(format!("StartTime='{}'", start.replace('"', "'")));
            }
        }
        if let Some(end) = &end_time {
            if !end.trim().is_empty() {
                security_filter_parts.push(format!("EndTime='{}'", end.replace('"', "'")));
            }
        }
        
        // Construire la commande avec gestion d'erreurs intégrée
        format!(
            "try {{ Get-WinEvent -FilterHashtable @{{{}}} -MaxEvents {} -ErrorAction Stop | \
             Select-Object -Property Id, LevelDisplayName, ProviderName, @{{Name='TimeCreated';Expression={{$_.TimeCreated}}}}, Message | \
             ConvertTo-Json -Depth 3 -Compress }} catch [System.Exception] {{ \
             if ($_.Exception.Message -like '*No events were found*') {{ \
                Write-Output '[]' \
             }} else {{ \
                Write-Error $_.Exception.Message \
                exit 1 \
             }} }}",
            security_filter_parts.join("; "),
            max_events
        )
    } else {
        // Pour les autres journaux, utiliser l'approche normale
        let part1 = format!("Get-WinEvent -FilterHashtable {} -MaxEvents {} -ErrorAction SilentlyContinue | ", filter_hashtable, max_events);
        let part2 = "Select-Object -Property Id, LevelDisplayName, ProviderName, @{Name='TimeCreated';Expression={$_.TimeCreated}}, Message | ";
        let part3 = "ConvertTo-Json -Depth 3 -Compress";
        vec![part1, part2.to_string(), part3.to_string()].join("")
    };

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) // Passer la commande construite
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-WinEvent: {}", e))?;

    // Pour le journal de sécurité, nous avons géré les erreurs dans la commande PowerShell elle-même
    if !output.status.success() && log_name != "Security" {
        // Vérifier le contenu de stderr pour déterminer si c'est l'erreur "No events found"
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Si l'erreur est "No events were found that match the specified selection criteria",
        // renvoyer une liste vide plutôt qu'une erreur
        if stderr.contains("No events were found that match the specified selection criteria") {
            println!("Aucun événement trouvé pour les critères spécifiés dans le journal '{}'", log_name);
            return Ok(vec![]);
        }
        
        return Err(format!("Get-WinEvent pour '{}' a échoué: {:?} \nErreur: {}", 
            log_name, output.status, stderr));
    }

    let events_json_str = String::from_utf8_lossy(&output.stdout);

    if events_json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parser la sortie JSON
    let parsed_events: Vec<PsWinEvent> = if events_json_str.trim().starts_with('[') {
        match serde_json::from_str(&events_json_str) {
            Ok(events) => events,
            Err(e) => {
                println!("Erreur parsing JSON (tableau) événements '{}': {}", log_name, e);
                // Si l'erreur est due à un JSON vide ou mal formé, retourner un vecteur vide
                return Ok(vec![]);
            }
        }
    } else {
        match serde_json::from_str::<PsWinEvent>(&events_json_str) {
            Ok(event) => vec![event],
            Err(e) => {
                println!("Erreur parsing JSON (objet unique) événements '{}': {}", log_name, e);
                // Si l'erreur est due à un JSON vide ou mal formé, retourner un vecteur vide
                return Ok(vec![]);
            }
        }
    };

    // Mapper vers la structure finale
    let final_events = parsed_events.into_iter().map(|ps_event| {
        let time_created_str = ps_event.time_created
            .as_ref()
            .and_then(|v| v.get("DateTime"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "N/A".to_string());

        EventLogEntry {
            event_id: ps_event.event_id,
            level: ps_event.level.unwrap_or_else(|| "Inconnu".to_string()),
            provider_name: ps_event.provider_name,
            time_created: time_created_str,
            message: ps_event.message.unwrap_or_default(),
        }
    }).collect();

    Ok(final_events)
}

#[command]
pub async fn clear_event_log(app: AppHandle, log_name: String) -> Result<(), String> {
     println!("Real: clear_event_log(log: '{}') called", log_name);
     // Important: Nécessite des privilèges admin
     if log_name.trim().is_empty() {
        return Err("Nom de journal invalide".to_string());
     }
     let command = format!("Clear-EventLog -LogName \"{}\"", log_name.replace('"', "'"));
     let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur Clear-EventLog: {}", e))?;
    if !output.status.success() {
        return Err(format!("Clear-EventLog '{}' a échoué: {:?} \nErreur: {}", 
            log_name, output.status, String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
} 