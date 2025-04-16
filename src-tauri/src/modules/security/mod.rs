use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value;

// Structure pour parser le JSON de Get-NetFirewallRule
// Utiliser serde(alias) pour gérer les variations de noms si nécessaire (ex: "Name" vs "DisplayName")
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsFirewallRule {
    // #[serde(alias = "Name")] // Alias si le nom de propriété peut varier
    display_name: String,
    enabled: u8,
    direction: u8, // Inbound/Outbound
    action: u8,    // Allow/Block
    profile: u8,   // Any, Domain, Private, Public
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct FirewallRuleInfo {
    name: String,
    enabled: bool,
    direction: String,
    action: String,
    profile: String,
}

// --- Structures Antivirus --- 

// Structure pour parser l'objet date JSON de PowerShell
#[derive(Deserialize, Debug, Clone)] 
#[serde(rename_all = "PascalCase")]
struct PsDateObject {
    date_time: Option<String>,
}

// Structure pour parser le JSON de Get-MpComputerStatus
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsMpComputerStatus {
    antispyware_enabled: Option<bool>,
    real_time_protection_enabled: Option<bool>,
    antivirus_signature_version: Option<String>,
    // Gérer la date comme un objet potentiel
    last_full_scan_end_time: Option<Value>, 
    nis_signature_version: Option<String>, // Ajout version signature NIS
    // Ajouter d'autres champs si nécessaire
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct AntivirusStatusInfo {
    antispyware_enabled: bool,
    real_time_protection_enabled: bool,
    antivirus_signature_version: String,
    nis_signature_version: String,
    last_full_scan_end_time: String,
}

// --- Commandes --- 

#[command]
pub async fn list_firewall_rules(app: AppHandle) -> Result<Vec<FirewallRuleInfo>, String> {
    println!("Real: list_firewall_rules() called");

    // Sélectionner les propriétés voulues
    let command = "Get-NetFirewallRule | Select-Object DisplayName, Enabled, Direction, Action, Profile | ConvertTo-Json -Depth 3 -Compress";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-NetFirewallRule: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-NetFirewallRule a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let rules_json_str = String::from_utf8_lossy(&output.stdout);
    
    if rules_json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parser la sortie JSON (peut être un objet unique ou un tableau)
    let parsed_rules: Vec<PsFirewallRule> = if rules_json_str.trim().starts_with('[') {
        serde_json::from_str(&rules_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) règles pare-feu: {}\nJSON: {}", e, rules_json_str))?
    } else {
        serde_json::from_str::<PsFirewallRule>(&rules_json_str)
            .map(|rule| vec![rule])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) règles pare-feu: {}\nJSON: {}", e, rules_json_str))?
    };

    // Mapper vers la structure finale, convertir les entiers en chaînes descriptives
    let final_rules = parsed_rules.into_iter().map(|ps_rule| {
        let direction_str = match ps_rule.direction {
            1 => "Inbound".to_string(),
            2 => "Outbound".to_string(),
            _ => format!("Inconnu ({})", ps_rule.direction),
        };
        let action_str = match ps_rule.action {
            1 => "NotConfigured".to_string(), // Vérifier ces valeurs
            2 => "Allow".to_string(),
            3 => "Block".to_string(),
            _ => format!("Inconnu ({})", ps_rule.action),
        };
        // Profile est un bitmask : 1=Domain, 2=Private, 4=Public. Combiner les noms.
        let mut profiles = Vec::new();
        if (ps_rule.profile & 1) != 0 { profiles.push("Domain"); }
        if (ps_rule.profile & 2) != 0 { profiles.push("Private"); }
        if (ps_rule.profile & 4) != 0 { profiles.push("Public"); }
        let profile_str = if profiles.is_empty() { "Any".to_string() } else { profiles.join(", ") };

        FirewallRuleInfo {
            name: ps_rule.display_name,
            enabled: ps_rule.enabled == 1,
            direction: direction_str,
            action: action_str,
            profile: profile_str,
        }
    }).collect();

    Ok(final_rules)
}

#[command]
pub async fn get_antivirus_status(app: AppHandle) -> Result<AntivirusStatusInfo, String> {
    println!("Real: get_antivirus_status() called");

    // Sélectionner les propriétés voulues
    let command = "Get-MpComputerStatus | Select-Object AntispywareEnabled, RealTimeProtectionEnabled, AntivirusSignatureVersion, NisSignatureVersion, LastFullScanEndTime | ConvertTo-Json -Depth 3 -Compress";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-MpComputerStatus: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-MpComputerStatus a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let status_json_str = String::from_utf8_lossy(&output.stdout);
    
    if status_json_str.trim().is_empty() {
        return Err("Get-MpComputerStatus n'a retourné aucune information.".to_string());
    }

    // Parser la sortie JSON (devrait être un objet unique)
    let parsed_status: PsMpComputerStatus = serde_json::from_str(&status_json_str)
            .map_err(|e| format!("Erreur parsing JSON état antivirus: {}\nJSON: {}", e, status_json_str))?;
    
    // Extraire la date de la valeur JSON potentiellement complexe
    let last_scan_str = parsed_status.last_full_scan_end_time
        .as_ref()
        .and_then(|v| v.get("DateTime")) // Essayer d'extraire DateTime
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "N/A".to_string()); // Fallback si l'objet/champ n'existe pas

    // Mapper vers la structure finale
    let final_status = AntivirusStatusInfo {
        antispyware_enabled: parsed_status.antispyware_enabled.unwrap_or(false),
        real_time_protection_enabled: parsed_status.real_time_protection_enabled.unwrap_or(false),
        antivirus_signature_version: parsed_status.antivirus_signature_version.unwrap_or_else(|| "N/A".to_string()),
        nis_signature_version: parsed_status.nis_signature_version.unwrap_or_else(|| "N/A".to_string()),
        last_full_scan_end_time: last_scan_str,
    };

    Ok(final_status)
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn security_placeholder() -> Result<(), String> {
    println!("Placeholder: security command called");
    Err("Placeholder non utilisé".to_string())
}
*/ 