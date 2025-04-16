use serde::{Deserialize, Serialize};
use std::{fs, path::Path, result::Result};
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Structure pour les informations de mise à jour
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub url: String,
    pub release_date: String,
    pub description: String,
    pub is_critical: bool,
    pub size_mb: f32,
    pub changes: Vec<String>,
}

/// Structure pour le résultat de la vérification des mises à jour
#[derive(Serialize, Debug, Clone)]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub update_info: Option<UpdateInfo>,
}

/// Structure pour le résultat du téléchargement
#[derive(Serialize, Debug, Clone)]
pub struct DownloadResult {
    pub success: bool,
    pub file_path: String,
    pub message: String,
}

/// Structure pour le résultat de l'installation
#[derive(Serialize, Debug, Clone)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub restart_required: bool,
}

/// Commande pour vérifier si des mises à jour sont disponibles
#[command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    println!("Vérification des mises à jour via Bash...");
    
    // Obtenir la version actuelle
    let current_version = match get_current_version_bash(&app).await {
        Ok(version) => version,
        Err(e) => {
            println!("Erreur lors de la récupération de la version actuelle: {}", e);
            return Err(format!("Erreur lors de la récupération de la version actuelle: {}", e));
        }
    };
    
    println!("Version actuelle: {}", current_version);
    
    // URL du fichier de métadonnées sur GitHub
    let update_url = "https://raw.githubusercontent.com/utilisateur/tauriv2-admin-updates/main/version.json";
    
    // Commande Bash pour récupérer les données JSON avec curl
    let check_command = format!(
        "curl -s {} | tr -d '\\r'",
        update_url
    );
    
    println!("Exécution de la commande curl pour vérifier les mises à jour...");
    
    // Exécution de la commande via Git Bash
    let output = match app.shell()
        .command("bash")
        .args(&["-c", &check_command])
        .output()
        .await {
            Ok(output) => output,
            Err(e) => {
                println!("Erreur lors de l'exécution de Bash: {}", e);
                return Err(format!("Erreur lors de l'exécution de Bash: {}", e));
            }
        };
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        println!("Échec de la vérification des mises à jour: {}", error);
        return Err(format!("Échec de la vérification des mises à jour: {}", error));
    }
    
    // Analyser la réponse JSON (curl retourne directement le JSON sans besoin de nettoyage spécial)
    let response = String::from_utf8_lossy(&output.stdout);
    println!("Réponse JSON: {}", response);
    
    // Parser le JSON
    let update_info: UpdateInfo = match serde_json::from_str(&response) {
        Ok(info) => info,
        Err(e) => {
            println!("Erreur de parsing JSON: {}", e);
            
            // En mode debug, retourner des données simulées
            #[cfg(debug_assertions)]
            {
                println!("Mode DEBUG: retour de données simulées");
                return Ok(get_simulated_update_result());
            }
            
            return Err(format!("Erreur de parsing JSON: {}", e));
        }
    };
    
    // Comparer les versions
    let latest_version = update_info.version.clone();
    let update_available = is_newer_version(&latest_version, &current_version);
    
    println!("Dernière version: {}, mise à jour disponible: {}", latest_version, update_available);
    
    // Renvoyer le résultat
    Ok(UpdateCheckResult {
        update_available,
        current_version,
        latest_version,
        update_info: if update_available { Some(update_info) } else { None }
    })
}

/// Fonction pour obtenir des données simulées (utilisée en développement ou en cas d'erreur)
fn get_simulated_update_result() -> UpdateCheckResult {
    let update_info = UpdateInfo {
        version: "1.1.0".to_string(),
        url: "https://votre-serveur.com/updates/windows-admin-tool-1.1.0.msi".to_string(),
        release_date: "2025-04-15".to_string(),
        description: "Mise à jour avec de nouvelles fonctionnalités et corrections de bugs".to_string(),
        is_critical: false,
        size_mb: 24.5,
        changes: vec![
            "Amélioration des performances".to_string(),
            "Nouvelle interface utilisateur".to_string(),
            "Correction de bogues".to_string()
        ],
    };
    
    UpdateCheckResult {
        update_available: true,
        current_version: "1.0.0".to_string(),
        latest_version: "1.1.0".to_string(),
        update_info: Some(update_info)
    }
}

/// Commande pour télécharger une mise à jour
#[command]
pub async fn download_update(app: AppHandle, update_url: String) -> Result<DownloadResult, String> {
    println!("Téléchargement de la mise à jour depuis: {}", update_url);
    
    // Créer un dossier temporaire pour le téléchargement
    let temp_dir = std::env::temp_dir().join("windows-admin-tool-updates");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Erreur lors de la création du dossier temporaire: {}", e))?;
    }
    
    // Extraire le nom du fichier de l'URL
    let file_name = match update_url.split('/').last() {
        Some(name) => name,
        None => "update.msi" // Nom par défaut si on ne peut pas extraire
    };
    
    let download_path = temp_dir.join(file_name);
    let download_path_str = download_path.to_string_lossy().to_string();
    
    // Commande Bash pour télécharger le fichier avec curl
    let download_command = format!(
        r#"
        # Afficher un message de début de téléchargement
        echo "Début du téléchargement depuis {0}..."
        
        # Téléchargement avec curl
        curl -s -L -o "{1}" "{0}"
        
        # Vérifier le statut de curl
        if [ $? -eq 0 ]; then
            # Vérifier que le fichier existe et obtenir sa taille
            if [ -f "{1}" ]; then
                FILE_SIZE=$(stat -c%s "{1}" 2>/dev/null || stat -f%z "{1}")
                FILE_SIZE_KB=$(echo "$FILE_SIZE/1024" | bc)
                
                # Créer un JSON de résultat
                cat <<EOF
                {{
                    "Success": true,
                    "FilePath": "{1}",
                    "Message": "Téléchargement réussi. Taille du fichier: $FILE_SIZE_KB KB"
                }}
EOF
                exit 0
            else
                echo "Échec du téléchargement: fichier non créé" >&2
                exit 1
            fi
        else
            echo "Erreur lors du téléchargement avec curl" >&2
            exit 1
        fi
        "#,
        update_url, 
        download_path_str
    );
    
    // Exécuter la commande via Bash
    let output = match app.shell()
        .command("bash")
        .args(&["-c", &download_command])
        .output()
        .await {
            Ok(output) => output,
            Err(e) => {
                println!("Erreur lors de l'exécution de Bash: {}", e);
                return Err(format!("Erreur lors de l'exécution de Bash: {}", e));
            }
        };
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        println!("Échec du téléchargement: {}", error);
        return Err(format!("Échec du téléchargement: {}", error));
    }
    
    // Analyser la réponse JSON
    let response = String::from_utf8_lossy(&output.stdout);
    println!("Réponse: {}", response);
    
    // Parser le JSON
    let download_result: serde_json::Value = match serde_json::from_str(&response) {
        Ok(result) => result,
        Err(e) => {
            println!("Erreur de parsing JSON: {}", e);
            
            // Si les données ne peuvent pas être parsées mais que le fichier existe, on renvoie quand même un succès
            if download_path.exists() {
                return Ok(DownloadResult {
                    success: true,
                    file_path: download_path_str,
                    message: "Téléchargement réussi (parsing JSON échoué)".to_string()
                });
            }
            
            return Err(format!("Erreur de parsing JSON: {}", e));
        }
    };
    
    // Renvoyer le résultat
    Ok(DownloadResult {
        success: download_result["Success"].as_bool().unwrap_or(false),
        file_path: download_path_str,
        message: download_result["Message"].as_str().unwrap_or("Téléchargement terminé").to_string()
    })
}

/// Commande pour installer une mise à jour
#[command]
pub async fn install_update(app: AppHandle, file_path: String) -> Result<InstallResult, String> {
    println!("Installation de la mise à jour depuis: {}", file_path);
    
    // Vérifier que le fichier existe
    if !Path::new(&file_path).exists() {
        return Err(format!("Le fichier de mise à jour n'existe pas: {}", file_path));
    }
    
    // Vérifier l'extension du fichier pour déterminer la méthode d'installation
    let extension = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    // Préparer la commande d'installation selon le type de fichier
    let install_command = match extension.as_str() {
        "msi" => format!(
            r#"
            # Vérifier que le fichier existe
            if [ ! -f "{0}" ]; then
                echo "Le fichier d'installation n'existe pas: {0}" >&2
                exit 1
            fi
            
            # Installation via msiexec (utilisation de wine en environnement bash)
            # Note: cela suppose que wine est installé pour les environnements non-Windows
            # Sur un vrai système Windows, il faudrait plutôt utiliser cmd.exe ou explorer.exe pour exécuter le MSI
            
            if command -v msiexec >/dev/null 2>&1; then
                # Si msiexec est disponible directement (Windows natif)
                echo "Installation via msiexec natif..."
                msiexec /i "{0}" /quiet /norestart &
                INSTALL_PID=$!
                
                # Attendre que l'installation soit terminée
                wait $INSTALL_PID
                EXIT_CODE=$?
                
            elif command -v wine >/dev/null 2>&1; then
                # Si wine est disponible (Linux/macOS)
                echo "Installation via wine msiexec..."
                wine msiexec /i "{0}" /quiet /norestart &
                INSTALL_PID=$!
                
                # Attendre que l'installation soit terminée
                wait $INSTALL_PID
                EXIT_CODE=$?
                
            else
                echo "Impossible de trouver un moyen d'installer le fichier MSI" >&2
                EXIT_CODE=1
            fi
            
            # Analyser le code de sortie
            if [ $EXIT_CODE -eq 0 ]; then
                cat <<EOF
                {{
                    "Success": true,
                    "Message": "Installation MSI réussie",
                    "RestartRequired": false
                }}
EOF
            elif [ $EXIT_CODE -eq 3010 ]; then
                cat <<EOF
                {{
                    "Success": true,
                    "Message": "Installation MSI réussie, redémarrage requis",
                    "RestartRequired": true
                }}
EOF
            else
                cat <<EOF
                {{
                    "Success": false,
                    "Message": "Échec de l'installation MSI, code de sortie: $EXIT_CODE",
                    "RestartRequired": false
                }}
EOF
            fi
            "#,
            file_path
        ),
        
        "exe" => format!(
            r#"
            # Vérifier que le fichier existe
            if [ ! -f "{0}" ]; then
                echo "Le fichier d'installation n'existe pas: {0}" >&2
                exit 1
            fi
            
            # Rendre le fichier exécutable
            chmod +x "{0}"
            
            # Lancer l'exécutable (dans un environnement Windows via Git Bash)
            # Note: en environnement Linux/macOS, il faudrait utiliser wine
            
            if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]]; then
                # Environnement Windows (Git Bash/Msys/Cygwin)
                echo "Installation via exécutable natif..."
                "{0}" /S &
                INSTALL_PID=$!
                
                # Attendre que l'installation soit terminée
                wait $INSTALL_PID
                EXIT_CODE=$?
                
            elif command -v wine >/dev/null 2>&1; then
                # Si wine est disponible (Linux/macOS)
                echo "Installation via wine..."
                wine "{0}" /S &
                INSTALL_PID=$!
                
                # Attendre que l'installation soit terminée
                wait $INSTALL_PID
                EXIT_CODE=$?
                
            else
                echo "Impossible de trouver un moyen d'installer le fichier EXE" >&2
                EXIT_CODE=1
            fi
            
            # Analyser le code de sortie
            if [ $EXIT_CODE -eq 0 ]; then
                cat <<EOF
                {{
                    "Success": true,
                    "Message": "Installation EXE réussie",
                    "RestartRequired": false
                }}
EOF
            else
                cat <<EOF
                {{
                    "Success": false,
                    "Message": "Échec de l'installation EXE, code de sortie: $EXIT_CODE",
                    "RestartRequired": false
                }}
EOF
            fi
            "#,
            file_path
        ),
        
        _ => return Err(format!("Type de fichier non pris en charge: {}", extension))
    };
    
    // Exécuter la commande via Bash
    let output = match app.shell()
        .command("bash")
        .args(&["-c", &install_command])
        .output()
        .await {
            Ok(output) => output,
            Err(e) => {
                println!("Erreur lors de l'exécution de Bash: {}", e);
                return Err(format!("Erreur lors de l'exécution de Bash: {}", e));
            }
        };
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        println!("Échec de l'installation: {}", error);
        return Err(format!("Échec de l'installation: {}", error));
    }
    
    // Analyser la réponse JSON
    let response = String::from_utf8_lossy(&output.stdout);
    println!("Réponse: {}", response);
    
    // Parser le JSON
    let install_result: serde_json::Value = match serde_json::from_str(&response) {
        Ok(result) => result,
        Err(e) => {
            println!("Erreur de parsing JSON: {}", e);
            return Err(format!("Erreur de parsing JSON: {}", e));
        }
    };
    
    // Renvoyer le résultat
    Ok(InstallResult {
        success: install_result["Success"].as_bool().unwrap_or(false),
        message: install_result["Message"].as_str().unwrap_or("Installation terminée").to_string(),
        restart_required: install_result["RestartRequired"].as_bool().unwrap_or(false)
    })
}

/// Obtient la version actuelle de l'application via Bash
async fn get_current_version_bash(app: &AppHandle) -> Result<String, String> {
    println!("Récupération de la version actuelle via Bash...");
    
    // Commande bash pour lire la version depuis Cargo.toml
    let bash_command = r#"
    # Rechercher le fichier Cargo.toml dans les répertoires parents
    CARGO_FILE=$(find $(pwd) -name "Cargo.toml" -type f | head -n 1)
    
    if [ -z "$CARGO_FILE" ]; then
        # Si on ne trouve pas le fichier, retourner version par défaut
        echo "1.0.0"
        exit 0
    fi
    
    # Extraire la version avec grep et sed
    VERSION=$(grep -m 1 "version" "$CARGO_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$VERSION" ]; then
        # Version par défaut si non trouvée
        echo "1.0.0"
    else
        echo "$VERSION"
    fi
    "#;
    
    // Exécution via Bash
    let output = match app.shell()
        .command("bash")
        .args(&["-c", bash_command])
        .output()
        .await {
            Ok(output) => output,
            Err(e) => {
                println!("Erreur lors de l'exécution de Bash: {}", e);
                return Err(format!("Erreur lors de l'exécution de Bash: {}", e));
            }
        };
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        println!("Échec de la récupération de version: {}", error);
        return Err(format!("Échec de la récupération de version: {}", error));
    }
    
    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    println!("Version actuelle récupérée: {}", version_str);
    
    Ok(version_str)
}

/// Compare deux versions pour déterminer si une nouvelle version est disponible
fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_version = |v: &str| -> Vec<u32> {
        v.split('.')
         .filter_map(|s| s.parse::<u32>().ok())
         .collect()
    };
    
    let latest_parts = parse_version(latest);
    let current_parts = parse_version(current);
    
    for i in 0..std::cmp::max(latest_parts.len(), current_parts.len()) {
        let latest_part = latest_parts.get(i).unwrap_or(&0);
        let current_part = current_parts.get(i).unwrap_or(&0);
        
        if latest_part > current_part {
            return true;
        } else if latest_part < current_part {
            return false;
        }
    }
    
    // Les versions sont identiques
    false
}

/// Helper pour nettoyer la sortie PowerShell JSON
fn clean_powershell_output(output: &str) -> String {
    // Retirer les lignes vides au début
    let trimmed = output.trim();
    // Prendre uniquement la dernière ligne non vide si multiples lignes
    // (PowerShell ajoute parfois des messages de debug/verbose)
    match trimmed.split('\n').last() {
        Some(last_line) => last_line.trim().to_string(),
        None => trimmed.to_string(),
    }
}

/// Commande pour redémarrer l'application après une mise à jour
#[command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    println!("Redémarrage de l'application via Bash...");
    
    // Script Bash pour redémarrer l'application
    let restart_command = r#"
    # Attendre un peu pour que l'UI ait le temps de traiter
    sleep 1
    
    # Obtenir le PID actuel
    CURRENT_PID=$$
    
    # Obtenir le chemin de l'exécutable à partir du PID
    # Sur Windows (via Git Bash), wmic peut être utilisé
    # Sur Linux/macOS, différentes méthodes sont disponibles
    if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]]; then
        # Méthode Windows via Git Bash
        EXE_PATH=$(wmic process where "ProcessId=$CURRENT_PID" get ExecutablePath | grep -v ExecutablePath | tr -d ' \r\n')
    else
        # Méthode Unix/Linux
        EXE_PATH=$(readlink /proc/$CURRENT_PID/exe 2>/dev/null || ps -p $CURRENT_PID -o command= 2>/dev/null)
    fi
    
    # Créer un script temporaire qui redémarrera l'application
    TEMP_SCRIPT=$(mktemp).sh
    
    cat > "$TEMP_SCRIPT" << 'RESTART_SCRIPT'
    #!/bin/bash
    # Attendre que le processus parent se termine
    sleep 1
    # Démarrer la nouvelle instance
    "$1" &
    # Nettoyer le script
    rm -f "$0"
RESTART_SCRIPT
    
    # Rendre le script exécutable
    chmod +x "$TEMP_SCRIPT"
    
    # Exécuter le script en arrière-plan avec le chemin de l'exécutable en argument
    bash "$TEMP_SCRIPT" "$EXE_PATH" &
    
    # Indiquer le succès
    echo "Redémarrage programmé"
    "#;
    
    // Exécuter la commande via Bash
    let output = match app.shell()
        .command("bash")
        .args(&["-c", restart_command])
        .output()
        .await {
            Ok(output) => output,
            Err(e) => {
                println!("Erreur lors de l'exécution de Bash: {}", e);
                return Err(format!("Erreur lors de l'exécution de Bash: {}", e));
            }
        };
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        println!("Échec du redémarrage: {}", error);
        return Err(format!("Échec du redémarrage: {}", error));
    }
    
    // Quitter l'application actuelle
    app.exit(0);
    
    Ok(())
} 