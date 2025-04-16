use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use serde_json::Value;

// Structure pour parser le JSON de Get-LocalUser
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsLocalUser {
    name: String,
    full_name: Option<String>,
    description: Option<String>,
    enabled: bool,
    // Les dates JSON de PowerShell peuvent être complexes, on les prend comme String pour l'instant
    // PasswordLastSet: Option<String>,
    sid: Option<Value>, // SID est un objet complexe, on le prend comme Value
}

// Structure finale retournée au frontend
#[derive(Serialize, Debug, Clone)]
pub struct LocalUserInfo {
    name: String,
    full_name: String,
    description: String,
    enabled: bool,
    // password_last_set: String,
    sid: String, // On va juste afficher le SID comme string
}

// --- Structs pour Groupes Locaux ---

// Structure pour parser le JSON de Get-LocalGroup
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsLocalGroup {
    name: String,
    description: Option<String>,
    sid: Option<Value>,
}

// Structure finale pour le groupe local
#[derive(Serialize, Debug, Clone)]
pub struct LocalGroupInfo {
    name: String,
    description: String,
    sid: String,
}

#[command]
pub async fn list_local_users(app: AppHandle) -> Result<Vec<LocalUserInfo>, String> {
    println!("Real: list_local_users() called");

    // Sélectionner les propriétés voulues et convertir en JSON
    // Note: PasswordLastSet peut être problématique à parser directement
    let command = "Get-LocalUser | Select-Object Name, FullName, Description, Enabled, SID | ConvertTo-Json -Depth 3 -Compress";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-LocalUser: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-LocalUser a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let users_json_str = String::from_utf8_lossy(&output.stdout);
    
    // Gérer le cas où aucun utilisateur n'est retourné (chaîne vide ou non JSON)
    if users_json_str.trim().is_empty() {
        return Ok(vec![]);
    }
    
    // Parser la sortie JSON (peut être un objet unique ou un tableau)
    let parsed_users: Vec<PsLocalUser> = if users_json_str.trim().starts_with('[') {
        serde_json::from_str(&users_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) utilisateurs: {}\nJSON: {}", e, users_json_str))?
    } else {
        serde_json::from_str::<PsLocalUser>(&users_json_str)
            .map(|user| vec![user])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) utilisateurs: {}\nJSON: {}", e, users_json_str))?
    };

    // Mapper vers la structure finale
    let final_users = parsed_users.into_iter().map(|ps_user| {
        // Extraire la valeur du SID (qui est un objet avec une propriété 'Value')
        let sid_string = ps_user.sid
            .as_ref()
            .and_then(|v| v.get("Value"))
            .and_then(|v| v.as_str())
            .unwrap_or("N/A")
            .to_string();

        LocalUserInfo {
            name: ps_user.name,
            full_name: ps_user.full_name.unwrap_or_default(),
            description: ps_user.description.unwrap_or_default(),
            enabled: ps_user.enabled,
            // password_last_set: ps_user.PasswordLastSet.unwrap_or_else(|| "N/A".to_string()),
            sid: sid_string,
        }
    }).collect();

    Ok(final_users)
}

// --- Nouvelle commande --- 
#[command]
pub async fn list_local_groups(app: AppHandle) -> Result<Vec<LocalGroupInfo>, String> {
    println!("Real: list_local_groups() called");

    // Sélectionner les propriétés voulues et convertir en JSON
    let command = "Get-LocalGroup | Select-Object Name, Description, SID | ConvertTo-Json -Depth 3 -Compress";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-LocalGroup: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-LocalGroup a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let groups_json_str = String::from_utf8_lossy(&output.stdout);
    
    if groups_json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    // Parser la sortie JSON (peut être un objet unique ou un tableau)
    let parsed_groups: Vec<PsLocalGroup> = if groups_json_str.trim().starts_with('[') {
        serde_json::from_str(&groups_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) groupes locaux: {}\nJSON: {}", e, groups_json_str))?
    } else {
        serde_json::from_str::<PsLocalGroup>(&groups_json_str)
            .map(|group| vec![group])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) groupes locaux: {}\nJSON: {}", e, groups_json_str))?
    };

    // Mapper vers la structure finale
    let final_groups = parsed_groups.into_iter().map(|ps_group| {
        // Extraire la valeur du SID
        let sid_string = ps_group.sid
            .as_ref()
            .and_then(|v| v.get("Value"))
            .and_then(|v| v.as_str())
            .unwrap_or("N/A")
            .to_string();

        LocalGroupInfo {
            name: ps_group.name,
            description: ps_group.description.unwrap_or_default(),
            sid: sid_string,
        }
    }).collect();

    Ok(final_groups)
}

// --- Commandes d'action Utilisateurs Locaux ---

#[command]
pub async fn add_local_user(
    app: AppHandle,
    user_name: String,
    password: String, // Recevoir le mot de passe
    full_name: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    println!("Real: add_local_user('{}') called", user_name);

    // Vérifier les champs requis
    if user_name.trim().is_empty() {
        return Err("Le nom d'utilisateur ne peut pas être vide.".to_string());
    }
    if password.is_empty() {
        return Err("Le mot de passe ne peut pas être vide.".to_string());
    }

    // Important: Nécessite des privilèges admin
    // Construire les parties de la commande
    let safe_user_name = user_name.replace('"', "''");
    let safe_full_name = full_name.unwrap_or_default().replace('"', "''");
    let safe_description = description.unwrap_or_default().replace('"', "''");
    // Échapper le mot de passe pour l'interpolation dans la chaîne PowerShell
    let safe_password = password.replace("\"", "\"\"").replace("'", "''");

    let part1 = format!("$Password = ConvertTo-SecureString -String \"{safe_password}\" -AsPlainText -Force;");
    let part2 = format!("New-LocalUser -Name \"{safe_user_name}\" -Password $Password -FullName \"{safe_full_name}\" -Description \"{safe_description}\"");
    // Joindre les parties avec un point-virgule (ou autre séparateur si nécessaire)
    let command = vec![part1, part2].join(" "); 

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) // Passer la commande complète
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de New-LocalUser: {}", e))?;

    if !output.status.success() {
        return Err(format!("New-LocalUser a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        Ok(())
    }
}

#[command]
pub async fn delete_local_user(app: AppHandle, user_name: String) -> Result<(), String> {
    println!("Real: delete_local_user('{}') called", user_name);

    // Important: Nécessite des privilèges admin
    let safe_user_name = user_name.replace('"', "''");
    let command = format!("Remove-LocalUser -Name \"{safe_user_name}\"");

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Remove-LocalUser: {}", e))?;

    if !output.status.success() {
        return Err(format!("Remove-LocalUser a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        Ok(())
    }
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn users_placeholder() -> Result<(), String> {
    println!("Placeholder: users command called");
    Err("Placeholder non utilisé".to_string())
}
*/ 