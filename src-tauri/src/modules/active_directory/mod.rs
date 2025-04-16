use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use std::env; // Pour lire les variables d'environnement
use serde_json::Value;

// Structure pour les informations AD de l'ordinateur
#[derive(Serialize, Debug, Clone)]
pub struct AdComputerInfo {
    is_joined: bool,
    domain_name: Option<String>,
    site_name: Option<String>,   // Ajouté
    logon_server: Option<String>, // Ajouté (DC qui a authentifié)
}

// Structure pour les informations de l'utilisateur connecté
#[derive(Serialize, Debug, Clone)]
pub struct LoggedInUserInfo {
    user_name: Option<String>,
    user_domain: Option<String>,
}

// Structure pour parser le JSON de Get-ADUser
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsAdUser {
    sam_account_name: String,
    name: String,
    enabled: bool,
    sid: Option<Value>,
}

// Structure finale pour l'utilisateur AD
#[derive(Serialize, Debug, Clone)]
pub struct AdUserInfo {
    sam_account_name: String,
    name: String,
    enabled: bool,
    sid: String,
}

// Structure pour parser le JSON de Get-ADComputer
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsAdComputer {
    name: String,
    #[serde(rename = "DNSHostName")]
    dns_host_name: String,
    enabled: bool,
    operating_system: Option<String>,
    // Ajouter d'autres champs si utile (OperatingSystemVersion, etc.)
}

// Structure finale pour l'ordinateur AD TROUVÉ (RENOMMÉE)
#[derive(Serialize, Debug, Clone)]
pub struct FoundAdComputerInfo {
    name: String,
    dns_host_name: String,
    enabled: bool,
    operating_system: String,
}

// --- Structs pour Groupes et Membres ---

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsAdGroup {
    sam_account_name: String,
    name: String,
    group_category: String, // DomainLocal, Global, Universal
    group_scope: String,    // DomainLocal, Global, Universal
    sid: Option<Value>,
}

#[derive(Serialize, Debug, Clone)]
pub struct AdGroupInfo {
    sam_account_name: String,
    name: String,
    category: String,
    scope: String,
    sid: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsAdGroupMember {
    sam_account_name: String,
    name: String,
    object_class: String, // user, group, computer
    sid: Option<Value>,
}

#[derive(Serialize, Debug, Clone)]
pub struct AdMemberInfo {
    sam_account_name: String,
    name: String,
    object_class: String,
    sid: String,
}

#[command]
pub async fn get_ad_computer_info(app: AppHandle) -> Result<AdComputerInfo, String> { // Renommée
    println!("Real: get_ad_computer_info() called");

    // 1. Obtenir le nom de domaine via WMI
    let domain_cmd = "(Get-WmiObject -Class Win32_ComputerSystem).Domain";
    let domain_output = app.shell()
        .command("powershell")
        .args(&["-Command", domain_cmd])
        .output()
        .await
        .map_err(|e| format!("Erreur WMI (Win32_ComputerSystem): {}", e))?;

    if !domain_output.status.success() {
        return Err(format!("Erreur WMI (Win32_ComputerSystem): {:?} \nErreur: {}", 
            domain_output.status, String::from_utf8_lossy(&domain_output.stderr)));
    }
    let domain_name_str = String::from_utf8_lossy(&domain_output.stdout).trim().to_string();
    let is_joined = !domain_name_str.is_empty();
    let domain_name = if is_joined { Some(domain_name_str) } else { None };

    let mut site_name: Option<String> = None;
    let mut logon_server: Option<String> = None;

    // Si joint à un domaine, essayer d'obtenir plus d'infos
    if is_joined {
        // 2. Obtenir le nom du site via WMI
        let site_cmd = "try { (Get-WmiObject -Class Win32_NTDomain -Filter \"DomainName='$((Get-WmiObject -Class Win32_ComputerSystem).Domain)\'\").ClientSiteName } catch { Write-Output \"\" }";
        let site_output = app.shell()
            .command("powershell")
            .args(&["-Command", site_cmd])
            .output()
            .await
            .map_err(|e| format!("Erreur WMI (Win32_NTDomain): {}", e))?;
        
        if site_output.status.success() {
            let site_name_str = String::from_utf8_lossy(&site_output.stdout).trim().to_string();
            if !site_name_str.is_empty() {
                site_name = Some(site_name_str);
            }
        } else {
             println!("Avertissement: Échec de la récupération du nom de site: {:?}", site_output.status);
        }

        // 3. Obtenir le serveur d'authentification via variable d'environnement
        // C'est souvent plus simple et disponible que nltest ou Get-ADDomainController sur les clients
        logon_server = env::var("LOGONSERVER").ok().map(|s| s.trim_start_matches("\\").to_string());
    }

    Ok(AdComputerInfo {
        is_joined,
        domain_name,
        site_name,
        logon_server,
    })
}

// --- Nouvelle commande --- 
#[command]
pub async fn get_logged_in_user_info() -> Result<LoggedInUserInfo, String> {
    println!("Real: get_logged_in_user_info() called");
    
    // Lire les variables d'environnement
    let user_name = env::var("USERNAME").ok();
    let user_domain = env::var("USERDOMAIN").ok();
    
    // Si le domaine utilisateur est le nom de la machine locale, considérer comme non-domaine
    let final_user_domain = user_domain.filter(|domain| {
        env::var("COMPUTERNAME").ok().map_or(true, |comp_name| comp_name != *domain)
    });

    Ok(LoggedInUserInfo {
        user_name,
        user_domain: final_user_domain,
    })
}

// --- Nouvelle commande d'action --- 
#[command]
pub async fn force_gp_update(app: AppHandle) -> Result<(), String> {
    println!("Real: force_gp_update() called");

    // Important: Nécessite des privilèges admin
    let command_name = "gpupdate";
    let command_args = &["/force"];

    // Séparer la commande et les arguments
    let output = app.shell()
        .command(command_name)
        .args(command_args) 
        .output()
        .await
        .map_err(|e| format!("Erreur lors du lancement de {}: {}", command_name, e))?;

    if !output.status.success() {
        // Analyser la sortie pour des messages spécifiques si nécessaire
        return Err(format!("{} a échoué: {:?} \nErreur: {}\nSortie: {}", 
            command_name,
            output.status, 
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&output.stdout)
        ));
    } else {
        println!("{} stdout: {}", command_name, String::from_utf8_lossy(&output.stdout));
        Ok(())
    }
}

// --- Nouvelle commande --- 
#[command]
pub async fn search_ad_users(app: AppHandle, filter: String) -> Result<Vec<AdUserInfo>, String> {
    println!("Real: search_ad_users(filter: '{}') called", filter);

    // 1. Vérifier si joint à un domaine
    //    On pourrait appeler get_ad_computer_info ici, mais WMI est rapide
    let domain_check_cmd = "(Get-WmiObject -Class Win32_ComputerSystem).PartOfDomain";
    let domain_check_output = app.shell().command("powershell").args(&["-Command", domain_check_cmd]).output().await
        .map_err(|e| format!("Erreur WMI (PartOfDomain check): {}", e))?;
    if !domain_check_output.status.success() {
        return Err("Impossible de vérifier l'appartenance au domaine.".to_string());
    }
    let is_joined_str = String::from_utf8_lossy(&domain_check_output.stdout).trim().to_lowercase();
    if is_joined_str != "true" {
         return Err("L'ordinateur n'est pas joint à un domaine Active Directory.".to_string());
    }

    // 2. Vérifier si le module AD est disponible
    let module_check_cmd = "if (Get-Module -ListAvailable -Name ActiveDirectory) { $true } else { $false }";
    let module_check_output = app.shell().command("powershell").args(&["-Command", module_check_cmd]).output().await
        .map_err(|e| format!("Erreur vérification module AD: {}", e))?;
    if !module_check_output.status.success() {
        return Err("Impossible de vérifier la présence du module Active Directory.".to_string());
    }
    let module_exists_str = String::from_utf8_lossy(&module_check_output.stdout).trim().to_lowercase();
    if module_exists_str != "true" {
        return Err("Le module PowerShell Active Directory n'est pas installé sur cette machine.".to_string());
    }

    // 3. Exécuter la recherche AD
    // Échapper les caractères spéciaux pour le filtre PowerShell si nécessaire
    let safe_filter = filter.replace("\"", "`\"").replace("'", "`'").replace("*", "`*");
    let command = format!(
        "Get-ADUser -Filter {{ Name -like \"*{safe_filter}*\" -or SamAccountName -like \"*{safe_filter}*\" }} | Select-Object SamAccountName, Name, Enabled, SID | ConvertTo-Json -Depth 3 -Compress"
    );

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-ADUser: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-ADUser a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let users_json_str = String::from_utf8_lossy(&output.stdout);
    if users_json_str.trim().is_empty() {
        return Ok(vec![]); // Aucun utilisateur trouvé
    }

    // Parser la sortie JSON
    let parsed_users: Vec<PsAdUser> = if users_json_str.trim().starts_with('[') {
        serde_json::from_str(&users_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) utilisateurs AD: {}\nJSON: {}", e, users_json_str))?
    } else {
        serde_json::from_str::<PsAdUser>(&users_json_str)
            .map(|user| vec![user])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) utilisateurs AD: {}\nJSON: {}", e, users_json_str))?
    };

    // Mapper vers la structure finale
    let final_users = parsed_users.into_iter().map(|ps_user| {
        let sid_string = ps_user.sid
            .as_ref()
            .and_then(|v| v.get("Value"))
            .and_then(|v| v.as_str())
            .unwrap_or("N/A")
            .to_string();
        AdUserInfo {
            sam_account_name: ps_user.sam_account_name,
            name: ps_user.name,
            enabled: ps_user.enabled,
            sid: sid_string,
        }
    }).collect();

    Ok(final_users)
}

// --- Nouvelle commande --- 
#[command]
pub async fn search_ad_computers(app: AppHandle, filter: String) -> Result<Vec<FoundAdComputerInfo>, String> {
    println!("Real: search_ad_computers(filter: '{}') called", filter);

    // Réutiliser les vérifications de jonction domaine et module AD (copiées/collées pour l'instant)
    // TODO: Refactoriser ces vérifications dans une fonction helper ?
    let domain_check_cmd = "(Get-WmiObject -Class Win32_ComputerSystem).PartOfDomain";
    let domain_check_output = app.shell().command("powershell").args(&["-Command", domain_check_cmd]).output().await
        .map_err(|e| format!("Erreur WMI (PartOfDomain check): {}", e))?;
    if !domain_check_output.status.success() {
        return Err("Impossible de vérifier l'appartenance au domaine.".to_string());
    }
    let is_joined_str = String::from_utf8_lossy(&domain_check_output.stdout).trim().to_lowercase();
    if is_joined_str != "true" {
         return Err("L'ordinateur n'est pas joint à un domaine Active Directory.".to_string());
    }
    let module_check_cmd = "if (Get-Module -ListAvailable -Name ActiveDirectory) { $true } else { $false }" ;
    let module_check_output = app.shell().command("powershell").args(&["-Command", module_check_cmd]).output().await
        .map_err(|e| format!("Erreur vérification module AD: {}", e))?;
    if !module_check_output.status.success() {
        return Err("Impossible de vérifier la présence du module Active Directory.".to_string());
    }
    let module_exists_str = String::from_utf8_lossy(&module_check_output.stdout).trim().to_lowercase();
    if module_exists_str != "true" {
        return Err("Le module PowerShell Active Directory n'est pas installé sur cette machine.".to_string());
    }

    // Exécuter la recherche AD
    // Échapper correctement les caractères pour l'interpolation dans le filtre PowerShell
    let safe_filter = filter.replace("\"", "\"\"").replace("'", "''").replace("*", ""); // Échapper " et ', supprimer *
    let command = format!(
        "Get-ADComputer -Filter {{ Name -like \"*{safe_filter}*\" -or DNSHostName -like \"*{safe_filter}*\" }} | Select-Object Name, DNSHostName, Enabled, OperatingSystem | ConvertTo-Json -Depth 3 -Compress"
        // Laisser safe_filter tel quel ici, PowerShell l'interprétera correctement dans le bloc -Filter
    );

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) // Passer la commande formatée
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-ADComputer: {}", e))?;

    if !output.status.success() {
        return Err(format!("Get-ADComputer a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    }

    let computers_json_str = String::from_utf8_lossy(&output.stdout);
    if computers_json_str.trim().is_empty() {
        return Ok(vec![]); // Aucun ordinateur trouvé
    }

    // Parser la sortie JSON
    let parsed_computers: Vec<PsAdComputer> = if computers_json_str.trim().starts_with('[') {
        serde_json::from_str(&computers_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) ordinateurs AD: {}\nJSON: {}", e, computers_json_str))?
    } else {
        serde_json::from_str::<PsAdComputer>(&computers_json_str)
            .map(|computer| vec![computer])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) ordinateurs AD: {}\nJSON: {}", e, computers_json_str))?
    };

    // Mapper vers la structure finale (RENOMMÉE)
    let final_computers = parsed_computers.into_iter().map(|ps_comp| {
        FoundAdComputerInfo {
            name: ps_comp.name,
            dns_host_name: ps_comp.dns_host_name,
            enabled: ps_comp.enabled,
            operating_system: ps_comp.operating_system.unwrap_or_else(|| "Inconnu".to_string()),
        }
    }).collect();

    Ok(final_computers)
}

// --- Fonctions Helper (pour éviter la répétition) ---

async fn check_ad_prerequisites(app: &AppHandle) -> Result<(), String> {
    // 1. Vérifier si joint à un domaine
    let domain_check_cmd = "(Get-WmiObject -Class Win32_ComputerSystem).PartOfDomain";
    let domain_check_output = app.shell().command("powershell").args(&["-Command", domain_check_cmd]).output().await
        .map_err(|e| format!("Erreur WMI (PartOfDomain check): {}", e))?;
    if !domain_check_output.status.success() {
        return Err("Impossible de vérifier l'appartenance au domaine.".to_string());
    }
    let is_joined_str = String::from_utf8_lossy(&domain_check_output.stdout).trim().to_lowercase();
    if is_joined_str != "true" {
         return Err("L'ordinateur n'est pas joint à un domaine Active Directory.".to_string());
    }

    // 2. Vérifier si le module AD est disponible
    let module_check_cmd = "if (Get-Module -ListAvailable -Name ActiveDirectory) { $true } else { $false }" ;
    let module_check_output = app.shell().command("powershell").args(&["-Command", module_check_cmd]).output().await
        .map_err(|e| format!("Erreur vérification module AD: {}", e))?;
    if !module_check_output.status.success() {
        return Err("Impossible de vérifier la présence du module Active Directory.".to_string());
    }
    let module_exists_str = String::from_utf8_lossy(&module_check_output.stdout).trim().to_lowercase();
    if module_exists_str != "true" {
        return Err("Le module PowerShell Active Directory n'est pas installé sur cette machine.".to_string());
    }
    Ok(())
}

fn parse_sid(sid_value: Option<&Value>) -> String {
    sid_value
        .and_then(|v| v.get("Value"))
        .and_then(|v| v.as_str())
        .unwrap_or("N/A")
        .to_string()
}

// --- Commandes AD supplémentaires ---

#[command]
pub async fn search_ad_groups(app: AppHandle, filter: String) -> Result<Vec<AdGroupInfo>, String> {
    println!("Real: search_ad_groups(filter: '{}') called", filter);
    check_ad_prerequisites(&app).await?;

    let safe_filter = filter.replace("\"", "\"\"").replace("'", "''").replace("*", ""); 
    let command = format!(
        "Get-ADGroup -Filter {{ Name -like \"*{safe_filter}*\" -or SamAccountName -like \"*{safe_filter}*\" }} | Select-Object SamAccountName, Name, GroupCategory, GroupScope, SID | ConvertTo-Json -Depth 3 -Compress"
    );

    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-ADGroup: {}", e))?;
    if !output.status.success() { return Err(format!("Get-ADGroup a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }

    let groups_json_str = String::from_utf8_lossy(&output.stdout);
    if groups_json_str.trim().is_empty() { return Ok(vec![]); }

    let parsed_groups: Vec<PsAdGroup> = if groups_json_str.trim().starts_with('[') {
        serde_json::from_str(&groups_json_str).map_err(|e| format!("Erreur parsing JSON groupes AD: {}", e))?
    } else {
        serde_json::from_str::<PsAdGroup>(&groups_json_str).map(|g| vec![g]).map_err(|e| format!("Erreur parsing JSON groupe AD: {}", e))?
    };

    let final_groups = parsed_groups.into_iter().map(|ps_group| AdGroupInfo {
        sam_account_name: ps_group.sam_account_name,
        name: ps_group.name,
        category: ps_group.group_category,
        scope: ps_group.group_scope,
        sid: parse_sid(ps_group.sid.as_ref()),
    }).collect();

    Ok(final_groups)
}

#[command]
pub async fn get_ad_group_members(app: AppHandle, group_identity: String) -> Result<Vec<AdMemberInfo>, String> {
    println!("Real: get_ad_group_members(group: '{}') called", group_identity);
    check_ad_prerequisites(&app).await?;

    let safe_identity = group_identity.replace("\"", "\"\"").replace("'", "''");
    let command = format!(
        "Get-ADGroupMember -Identity \"{safe_identity}\" | Select-Object SamAccountName, Name, objectClass, SID | ConvertTo-Json -Depth 3 -Compress"
    );

    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-ADGroupMember: {}", e))?;
    if !output.status.success() { return Err(format!("Get-ADGroupMember a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }

    let members_json_str = String::from_utf8_lossy(&output.stdout);
    if members_json_str.trim().is_empty() { return Ok(vec![]); }

    let parsed_members: Vec<PsAdGroupMember> = if members_json_str.trim().starts_with('[') {
        serde_json::from_str(&members_json_str).map_err(|e| format!("Erreur parsing JSON membres groupe: {}", e))?
    } else {
        serde_json::from_str::<PsAdGroupMember>(&members_json_str).map(|m| vec![m]).map_err(|e| format!("Erreur parsing JSON membre groupe: {}", e))?
    };

    let final_members = parsed_members.into_iter().map(|ps_member| AdMemberInfo {
        sam_account_name: ps_member.sam_account_name,
        name: ps_member.name,
        object_class: ps_member.object_class,
        sid: parse_sid(ps_member.sid.as_ref()),
    }).collect();

    Ok(final_members)
}

#[command]
pub async fn get_ad_principal_group_membership(app: AppHandle, principal_identity: String) -> Result<Vec<AdGroupInfo>, String> {
    println!("Real: get_ad_principal_group_membership(principal: '{}') called", principal_identity);
    check_ad_prerequisites(&app).await?;

    let safe_identity = principal_identity.replace("\"", "\"\"").replace("'", "''");
    let command = format!(
        "Get-ADPrincipalGroupMembership -Identity \"{safe_identity}\" | Select-Object SamAccountName, Name, GroupCategory, GroupScope, SID | ConvertTo-Json -Depth 3 -Compress"
    );

    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-ADPrincipalGroupMembership: {}", e))?;
    if !output.status.success() { return Err(format!("Get-ADPrincipalGroupMembership a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }

    let groups_json_str = String::from_utf8_lossy(&output.stdout);
    if groups_json_str.trim().is_empty() { return Ok(vec![]); }

     let parsed_groups: Vec<PsAdGroup> = if groups_json_str.trim().starts_with('[') {
        serde_json::from_str(&groups_json_str).map_err(|e| format!("Erreur parsing JSON groupes appartenance: {}", e))?
    } else {
        serde_json::from_str::<PsAdGroup>(&groups_json_str).map(|g| vec![g]).map_err(|e| format!("Erreur parsing JSON groupe appartenance: {}", e))?
    };

    let final_groups = parsed_groups.into_iter().map(|ps_group| AdGroupInfo {
        sam_account_name: ps_group.sam_account_name,
        name: ps_group.name,
        category: ps_group.group_category,
        scope: ps_group.group_scope,
        sid: parse_sid(ps_group.sid.as_ref()),
    }).collect();

    Ok(final_groups)
}

#[command]
pub async fn enable_ad_account(app: AppHandle, account_identity: String) -> Result<(), String> {
    println!("Real: enable_ad_account(account: '{}') called", account_identity);
    check_ad_prerequisites(&app).await?;
    let safe_identity = account_identity.replace("\"", "\"\"").replace("'", "''");
    let command = format!("Enable-ADAccount -Identity \"{safe_identity}\"");
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Enable-ADAccount: {}", e))?;
    if !output.status.success() { return Err(format!("Enable-ADAccount a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }
    Ok(())
}

#[command]
pub async fn disable_ad_account(app: AppHandle, account_identity: String) -> Result<(), String> {
    println!("Real: disable_ad_account(account: '{}') called", account_identity);
    check_ad_prerequisites(&app).await?;
    let safe_identity = account_identity.replace("\"", "\"\"").replace("'", "''");
    let command = format!("Disable-ADAccount -Identity \"{safe_identity}\"");
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Disable-ADAccount: {}", e))?;
     if !output.status.success() { return Err(format!("Disable-ADAccount a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }
    Ok(())
}

#[command]
pub async fn unlock_ad_account(app: AppHandle, account_identity: String) -> Result<(), String> {
    println!("Real: unlock_ad_account(account: '{}') called", account_identity);
     check_ad_prerequisites(&app).await?;
    let safe_identity = account_identity.replace("\"", "\"\"").replace("'", "''");
    let command = format!("Unlock-ADAccount -Identity \"{safe_identity}\"");
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Unlock-ADAccount: {}", e))?;
    if !output.status.success() { return Err(format!("Unlock-ADAccount a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }
    Ok(())
}

#[command]
pub async fn reset_ad_account_password(app: AppHandle, account_identity: String) -> Result<(), String> {
    println!("Real: reset_ad_account_password(account: '{}') called", account_identity);
    check_ad_prerequisites(&app).await?;
    let safe_identity = account_identity.replace("\"", "\"\"").replace("'", "''");
    let command = format!("Set-ADAccountPassword -Identity \"{safe_identity}\" -Reset");
    let output = app.shell().command("powershell").args(&["-Command", &command]).output().await
        .map_err(|e| format!("Erreur lors de l'exécution de Set-ADAccountPassword: {}", e))?;
    if !output.status.success() { return Err(format!("Set-ADAccountPassword a échoué: {:?} \nErreur: {}", output.status, String::from_utf8_lossy(&output.stderr))); }
    Ok(())
}

// Supprimer l'ancien placeholder
/*
#[command]
pub async fn active_directory_placeholder() -> Result<(), String> {
    println!("Placeholder: active_directory command called");
    Err("Placeholder non utilisé".to_string())
}
*/ 