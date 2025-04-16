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

/// Structure pour une release GitHub (format API GitHub)
#[derive(Deserialize, Debug)]
struct GitHubRelease {
    tag_name: String,
    name: String,
    body: String,
    published_at: String,
    assets: Vec<GitHubAsset>,
    #[serde(default)]
    prerelease: bool,
}

/// Structure pour un asset de release GitHub
#[derive(Deserialize, Debug)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

/// Commande pour vérifier si des mises à jour sont disponibles
#[command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    println!("Vérification des mises à jour via l'API GitHub...");
    
    // Obtenir la version actuelle
    let current_version = match get_current_version_bash(&app).await {
        Ok(version) => version,
        Err(e) => {
            println!("Erreur lors de la récupération de la version actuelle: {}", e);
            return Err(format!("Erreur lors de la récupération de la version actuelle: {}", e));
        }
    };
    
    println!("Version actuelle: {}", current_version);
    
    // URL de l'API GitHub pour les releases
    let repo_owner = "ATTILA-KRB";
    let repo_name = "tauriv2-admin";
    let github_api_url = format!("https://api.github.com/repos/{}/{}/releases", repo_owner, repo_name);
    
    // Déterminer le système d'exploitation
    let is_windows = cfg!(target_os = "windows");
    
    // Variable pour stocker la réponse
    let response: String;
    
    if is_windows {
        // Utiliser PowerShell pour Windows
        let check_command = format!(
            r#"
            try {{
                $headers = @{{
                    "Accept" = "application/vnd.github.v3+json"
                    "User-Agent" = "WindowsAdminTool/1.0"
                }}
                
                # Récupérer la réponse de l'API GitHub
                $response = Invoke-RestMethod -Uri "{}" -Headers $headers -Method Get -ErrorAction Stop
                
                # Vérifier si la réponse est déjà un tableau ou un objet unique
                if ($response -is [array]) {{
                    # C'est un tableau, le convertir en JSON
                    $response | ConvertTo-Json -Depth 10
                }} else {{
                    # C'est un objet unique, l'envelopper dans un tableau et convertir en JSON
                    @($response) | ConvertTo-Json -Depth 10
                }}
            }} catch {{
                Write-Error "Erreur lors de la requête API: $_"
                exit 1
            }}
            "#,
            github_api_url
        );
        
        // Exécuter via PowerShell
        let output = match app.shell()
            .command("powershell")
            .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &check_command])
            .output()
            .await {
                Ok(output) => output,
                Err(e) => {
                    println!("Erreur lors de l'exécution de PowerShell: {}", e);
                    // En mode debug, retourner des données simulées
                    #[cfg(debug_assertions)]
                    {
                        println!("Mode DEBUG: retour de données simulées");
                        return Ok(get_simulated_update_result());
                    }
                    return Err(format!("Erreur lors de l'exécution de PowerShell: {}", e));
                }
            };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Échec de la vérification des mises à jour: {}", error);
            
            // En mode debug, retourner des données simulées
            #[cfg(debug_assertions)]
            {
                println!("Mode DEBUG: retour de données simulées");
                return Ok(get_simulated_update_result());
            }
            
            return Err(format!("Échec de la vérification des mises à jour: {}", error));
        }
        
        response = String::from_utf8_lossy(&output.stdout).to_string();
    } else {
        // Utiliser curl via Bash pour macOS/Linux
        let bash_script = String::from(
            "
            # Récupérer la réponse de l'API GitHub
            API_RESPONSE=$(curl -s -H \"Accept: application/vnd.github.v3+json\" -H \"User-Agent: WindowsAdminTool/1.0\" GITHUB_API_URL)
            
            # Vérifier si la réponse est un tableau ou un objet
            FIRST_CHAR=$(echo \"$API_RESPONSE\" | tr -d '[:space:]' | cut -c1)
            
            if [ \"$FIRST_CHAR\" = \"[\" ]; then
                # C'est déjà un tableau, retourner tel quel
                echo \"$API_RESPONSE\" | tr -d '\\r'
            elif [ \"$FIRST_CHAR\" = \"{\" ]; then
                # C'est un objet, l'envelopper dans un tableau
                echo \"[$API_RESPONSE]\" | tr -d '\\r'
            else
                # Format inconnu ou erreur
                echo \"Erreur: Format de réponse inattendu\" >&2
                exit 1
            fi
            "
        );
        
        let check_command = bash_script.replace("GITHUB_API_URL", &github_api_url);
        
        // Exécuter via Bash
        let output = match app.shell()
            .command("bash")
            .args(&["-c", &check_command])
            .output()
            .await {
                Ok(output) => output,
                Err(e) => {
                    println!("Erreur lors de l'exécution de Bash: {}", e);
                    // En mode debug, retourner des données simulées
                    #[cfg(debug_assertions)]
                    {
                        println!("Mode DEBUG: retour de données simulées");
                        return Ok(get_simulated_update_result());
                    }
                    return Err(format!("Erreur lors de l'exécution de Bash: {}", e));
                }
            };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Échec de la vérification des mises à jour: {}", error);
            // En mode debug, retourner des données simulées
            #[cfg(debug_assertions)]
            {
                println!("Mode DEBUG: retour de données simulées");
                return Ok(get_simulated_update_result());
            }
            return Err(format!("Échec de la vérification des mises à jour: {}", error));
        }
        
        response = String::from_utf8_lossy(&output.stdout).to_string();
    }
    
    println!("Réponse reçue, analyse en cours...");
    
    // Vérifier si la réponse contient un message d'erreur de l'API GitHub
    if response.contains("\"message\":") && response.contains("\"documentation_url\":") {
        let error_response: serde_json::Value = match serde_json::from_str(&response) {
            Ok(value) => value,
            Err(e) => {
                println!("Erreur lors du parsing de la réponse d'erreur GitHub: {}", e);
                // En mode debug, retourner des données simulées
                #[cfg(debug_assertions)]
                {
                    println!("Mode DEBUG: retour de données simulées");
                    return Ok(get_simulated_update_result());
                }
                return Err(format!("Erreur de l'API GitHub: Impossible d'analyser la réponse"));
            }
        };
        
        let error_message = error_response["message"].as_str().unwrap_or("Erreur inconnue");
        println!("Erreur de l'API GitHub: {}", error_message);
        
        // Pour les erreurs de rate limit, retourner une version par défaut sans erreur
        if error_message.contains("rate limit") {
            println!("Limite d'API GitHub atteinte, retour de résultat par défaut");
            return Ok(UpdateCheckResult {
                update_available: false,
                current_version: current_version.clone(),
                latest_version: current_version,
                update_info: None
            });
        }
        
        return Err(format!("Erreur de l'API GitHub: {}", error_message));
    }
    
    // Parser la liste des releases
    let releases: Vec<GitHubRelease> = match serde_json::from_str::<Vec<GitHubRelease>>(&response) {
        Ok(releases) => releases,
        Err(array_err) => {
            // Si le parsing en tant que tableau échoue, essayer de parser comme une seule release
            println!("Échec de parsing en tant que tableau: {}", array_err);
            println!("Tentative de parsing comme objet unique...");
            
            match serde_json::from_str::<GitHubRelease>(&response) {
                Ok(single_release) => {
                    // Si c'est une release unique, la mettre dans un vecteur
                    vec![single_release]
                },
                Err(obj_err) => {
                    // Si les deux méthodes échouent, enregistrer les erreurs et renvoyer une erreur
                    println!("Erreur de parsing JSON (tableau): {}", array_err);
                    println!("Erreur de parsing JSON (objet): {}", obj_err);
                    println!("Début de la réponse reçue: {}", &response[..std::cmp::min(200, response.len())]);
                    
                    // En mode debug, retourner des données simulées
                    #[cfg(debug_assertions)]
                    {
                        println!("Mode DEBUG: retour de données simulées");
                        return Ok(get_simulated_update_result());
                    }
                    
                    return Err(format!("Erreur de parsing JSON: {}", array_err));
                }
            }
        }
    };
    
    // Vérifier s'il y a des releases
    if releases.is_empty() {
        println!("Aucune release trouvée sur GitHub");
        return Ok(UpdateCheckResult {
            update_available: false,
            current_version: current_version.clone(),
            latest_version: current_version,
            update_info: None
        });
    }
    
    // Récupérer la dernière release non-prerelease (ou la première si toutes sont des prereleases)
    let latest_release = releases.iter()
        .filter(|r| !r.prerelease)
        .next()
        .unwrap_or(&releases[0]);
    
    // Extraire la version du tag (supprimer le 'v' éventuel en préfixe)
    let latest_version = latest_release.tag_name.trim_start_matches('v').to_string();
    println!("Dernière version sur GitHub: {}", latest_version);
    
    // Comparer les versions
    let update_available = is_newer_version(&latest_version, &current_version);
    println!("Mise à jour disponible: {}", update_available);
    
    if !update_available {
        return Ok(UpdateCheckResult {
            update_available: false,
            current_version: current_version.clone(),
            latest_version,
            update_info: None
        });
    }
    
    // Trouver l'asset MSI ou EXE à télécharger
    let download_asset = latest_release.assets.iter()
        .find(|a| a.name.ends_with(".msi") || a.name.ends_with(".exe"));
    
    let download_url = match download_asset {
        Some(asset) => asset.browser_download_url.clone(),
        None => {
            println!("Aucun fichier d'installation trouvé dans la release");
            
            // Si aucun asset n'est trouvé mais qu'une mise à jour est disponible,
            // on renvoie quand même les informations de base mais sans URL
            let update_info = UpdateInfo {
                version: latest_version.clone(),
                url: "".to_string(),
                release_date: latest_release.published_at.clone(),
                description: latest_release.name.clone(),
                is_critical: false,
                size_mb: 0.0,
                changes: vec!["Consultez les notes de version sur GitHub".to_string()],
            };
            
            return Ok(UpdateCheckResult {
                update_available: true,
                current_version: current_version.clone(),
                latest_version,
                update_info: Some(update_info)
            });
        }
    };
    
    // Estimer la taille en MB
    let size_mb = (download_asset.unwrap().size as f32) / (1024.0 * 1024.0);
    
    // Extraire les notes de version au format Markdown
    let release_notes = latest_release.body.clone();
    
    // Convertir les notes de version en liste de changements
    let changes = release_notes
        .lines()
        .filter(|line| line.trim().starts_with('-') || line.trim().starts_with('*'))
        .map(|line| line.trim_start_matches('-').trim_start_matches('*').trim().to_string())
        .collect::<Vec<String>>();
    
    // Créer l'objet UpdateInfo
    let update_info = UpdateInfo {
        version: latest_version.clone(),
        url: download_url,
        release_date: latest_release.published_at.clone(),
        description: latest_release.name.clone(),
        is_critical: false, // Déterminé par défaut comme non critique
        size_mb,
        changes: if changes.is_empty() {
            vec!["Consultez les notes de version sur GitHub".to_string()]
        } else {
            changes
        },
    };
    
    // Renvoyer le résultat
    Ok(UpdateCheckResult {
        update_available,
        current_version: current_version.clone(),
        latest_version,
        update_info: Some(update_info)
    })
}

/// Fonction pour obtenir des données simulées (utilisée en développement ou en cas d'erreur)
fn get_simulated_update_result() -> UpdateCheckResult {
    let update_info = UpdateInfo {
        version: "1.1.0".to_string(),
        url: "https://github.com/ATTILA-KRB/tauriv2-admin/releases/download/v1.1.0/windows-admin-tool_1.1.0_x64-setup.exe".to_string(),
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
    
    // Valider l'URL
    if update_url.is_empty() {
        return Err("URL de téléchargement vide".to_string());
    }
    
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
    
    // Déterminer le système d'exploitation
    let is_windows = cfg!(target_os = "windows");
    
    if is_windows {
        // Utiliser PowerShell pour télécharger sous Windows
        let powershell_command = format!(
            r#"
            try {{
                $ProgressPreference = 'SilentlyContinue'  # Désactiver la barre de progression qui ralentit
                $TempDir = "{1}"
                $DownloadPath = "{2}"
                
                Write-Output "Début du téléchargement depuis {0}..."
                
                # Vérifier et créer le dossier si nécessaire
                if (-not (Test-Path -Path $TempDir -PathType Container)) {{
                    New-Item -Path $TempDir -ItemType Directory -Force | Out-Null
                }}
                
                # Télécharger le fichier
                Invoke-WebRequest -Uri '{0}' -OutFile $DownloadPath -UseBasicParsing
                
                # Vérifier que le téléchargement a réussi
                if (Test-Path $DownloadPath) {{
                    $FileSize = (Get-Item -Path $DownloadPath).Length
                    $FileSizeKB = [Math]::Round($FileSize / 1KB, 2)
                    
                    # Créer un objet JSON de résultat
                    $Result = @{{
                        Success = $true
                        FilePath = $DownloadPath
                        Message = "Téléchargement réussi. Taille du fichier: $FileSizeKB KB"
                    }}
                    
                    ConvertTo-Json -InputObject $Result
                }} else {{
                    throw "Le fichier n'existe pas après le téléchargement"
                }}
            }} catch {{
                Write-Error "Erreur lors du téléchargement: $_"
                exit 1
            }}
            "#,
            update_url, 
            temp_dir.to_string_lossy().to_string(),
            download_path_str
        );
        
        // Exécuter via PowerShell
        let output = match app.shell()
            .command("powershell")
            .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &powershell_command])
            .output()
            .await {
                Ok(output) => output,
                Err(e) => {
                    println!("Erreur lors de l'exécution de PowerShell: {}", e);
                    return Err(format!("Erreur lors de l'exécution de PowerShell: {}", e));
                }
            };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Échec du téléchargement: {}", error);
            return Err(format!("Échec du téléchargement: {}", error));
        }
        
        // Analyser la réponse JSON
        let response = String::from_utf8_lossy(&output.stdout);
        println!("Réponse PowerShell: {}", response);
        
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
    } else {
        // Commande Bash pour télécharger le fichier avec curl sous macOS/Linux
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
    
    // Déterminer le système d'exploitation
    let is_windows = cfg!(target_os = "windows");
    
    if is_windows {
        // Utiliser PowerShell sur Windows
        let powershell_command = match extension.as_str() {
            "msi" => format!(
                r#"
                try {{
                    $FilePath = "{0}"
                    
                    Write-Output "Vérification du fichier $FilePath"
                    if (-not (Test-Path -Path $FilePath -PathType Leaf)) {{
                        throw "Le fichier d'installation n'existe pas: $FilePath"
                    }}
                    
                    Write-Output "Démarrage de l'installation MSI..."
                    
                    # Exécuter msiexec en arrière-plan
                    $Process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$FilePath`" /quiet /norestart" -PassThru -Wait
                    $ExitCode = $Process.ExitCode
                    
                    Write-Output "Installation terminée avec le code de sortie: $ExitCode"
                    
                    # Analyser le code de sortie
                    if ($ExitCode -eq 0) {{
                        $Result = @{{
                            Success = $true
                            Message = "Installation MSI réussie"
                            RestartRequired = $false
                        }}
                    }} elseif ($ExitCode -eq 3010) {{
                        $Result = @{{
                            Success = $true
                            Message = "Installation MSI réussie, redémarrage requis"
                            RestartRequired = $true
                        }}
                    }} else {{
                        $Result = @{{
                            Success = $false
                            Message = "Échec de l'installation MSI, code de sortie: $ExitCode"
                            RestartRequired = $false
                        }}
                    }}
                    
                    ConvertTo-Json -InputObject $Result
                }} catch {{
                    Write-Error $_.Exception.Message
                    exit 1
                }}
                "#,
                file_path
            ),
            
            "exe" => format!(
                r#"
                try {{
                    $FilePath = "{0}"
                    
                    Write-Output "Vérification du fichier $FilePath"
                    if (-not (Test-Path -Path $FilePath -PathType Leaf)) {{
                        throw "Le fichier d'installation n'existe pas: $FilePath"
                    }}
                    
                    Write-Output "Démarrage de l'installation EXE..."
                    
                    # Exécuter l'exe avec les paramètres silencieux
                    $Process = Start-Process -FilePath $FilePath -ArgumentList "/S" -PassThru -Wait
                    $ExitCode = $Process.ExitCode
                    
                    Write-Output "Installation terminée avec le code de sortie: $ExitCode"
                    
                    # Analyser le code de sortie
                    if ($ExitCode -eq 0) {{
                        $Result = @{{
                            Success = $true
                            Message = "Installation EXE réussie"
                            RestartRequired = $false
                        }}
                    }} else {{
                        $Result = @{{
                            Success = $false
                            Message = "Échec de l'installation EXE, code de sortie: $ExitCode"
                            RestartRequired = $false
                        }}
                    }}
                    
                    ConvertTo-Json -InputObject $Result
                }} catch {{
                    Write-Error $_.Exception.Message
                    exit 1
                }}
                "#,
                file_path
            ),
            
            _ => return Err(format!("Type de fichier non pris en charge: {}", extension))
        };
        
        // Exécuter via PowerShell
        let output = match app.shell()
            .command("powershell")
            .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &powershell_command])
            .output()
            .await {
                Ok(output) => output,
                Err(e) => {
                    println!("Erreur lors de l'exécution de PowerShell: {}", e);
                    return Err(format!("Erreur lors de l'exécution de PowerShell: {}", e));
                }
            };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Échec de l'installation: {}", error);
            return Err(format!("Échec de l'installation: {}", error));
        }
        
        // Analyser la réponse JSON
        let response = String::from_utf8_lossy(&output.stdout);
        println!("Réponse PowerShell: {}", response);
        
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
    } else {
        // Préparer la commande d'installation selon le type de fichier pour Linux/macOS
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
        
        // Exécuter la commande via Bash pour Linux/macOS
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
}

/// Obtient la version actuelle de l'application
async fn get_current_version_bash(app: &AppHandle) -> Result<String, String> {
    println!("Récupération de la version actuelle...");
    
    // Déterminer le système d'exploitation
    let is_windows = cfg!(target_os = "windows");
    
    if is_windows {
        // Utiliser PowerShell sur Windows
        let powershell_command = r#"
        $CargoFile = Get-ChildItem -Path . -Recurse -Filter "Cargo.toml" | Select-Object -First 1 -ExpandProperty FullName
        
        if (-not $CargoFile) {
            # Version par défaut si le fichier n'est pas trouvé
            Write-Output "1.0.0"
            exit 0
        }
        
        # Lire le contenu et extraire la version
        $Content = Get-Content -Path $CargoFile
        $VersionLine = $Content | Where-Object { $_ -match "^version\s*=\s*`"([^`"]+)`"" }
        
        if ($VersionLine -match "version\s*=\s*`"([^`"]+)`"") {
            Write-Output $Matches[1]
        } else {
            # Version par défaut si non trouvée
            Write-Output "1.0.0"
        }
        "#;
        
        // Exécuter via PowerShell
        let output = match app.shell()
            .command("powershell")
            .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershell_command])
            .output()
            .await {
                Ok(output) => output,
                Err(e) => {
                    println!("Erreur lors de l'exécution de PowerShell: {}", e);
                    // Si PowerShell échoue, retourner une version par défaut
                    return Ok("1.0.0".to_string());
                }
            };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Avertissement - PowerShell a échoué, utilisation de la version par défaut: {}", error);
            return Ok("1.0.0".to_string());
        }
        
        let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if version_str.is_empty() {
            println!("Version vide détectée, utilisation de la version par défaut");
            return Ok("1.0.0".to_string());
        }
        
        println!("Version actuelle récupérée: {}", version_str);
        return Ok(version_str);
    } else {
        // Utiliser Bash sur macOS/Linux
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
                    // Si Bash échoue, retourner une version par défaut
                    return Ok("1.0.0".to_string());
                }
            };
        
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Avertissement - Bash a échoué, utilisation de la version par défaut: {}", error);
            return Ok("1.0.0".to_string());
        }
        
        let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if version_str.is_empty() {
            println!("Version vide détectée, utilisation de la version par défaut");
            return Ok("1.0.0".to_string());
        }
        
        println!("Version actuelle récupérée: {}", version_str);
        return Ok(version_str);
    }
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
    println!("Redémarrage de l'application...");
    
    // Déterminer le système d'exploitation
    let is_windows = cfg!(target_os = "windows");
    
    // Variable pour stocker le succès
    let success: bool;
    
    if is_windows {
        // Utiliser PowerShell pour redémarrer sous Windows
        let powershell_command = r#"
        try {
            # Obtenir le chemin de l'exécutable actuel
            $ExePath = (Get-Process -Id $PID).Path
            
            if (-not $ExePath) {
                # Si le chemin ne peut pas être trouvé, essayer de le trouver par d'autres moyens
                $ExePath = (Get-Process -Id $PID).MainModule.FileName
            }
            
            if (-not $ExePath) {
                # Si toujours pas trouvé, utiliser un autre moyen
                $ExePath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
            }
            
            Write-Output "Chemin d'exécutable détecté: $ExePath"
            
            # Créer un script temporaire pour le redémarrage
            $TempScript = [System.IO.Path]::GetTempFileName() + ".ps1"
            
            # Contenu du script de redémarrage
            $ScriptContent = @"
            Start-Sleep -Seconds 2  # Attendre que l'application se ferme
            Start-Process -FilePath "$ExePath"
            Remove-Item -Path "$TempScript"  # Auto-suppression
"@
            
            # Écrire le script
            Set-Content -Path $TempScript -Value $ScriptContent
            
            # Lancer le script en arrière-plan
            Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$TempScript`"" -WindowStyle Hidden
            
            Write-Output "Redémarrage programmé. L'application va maintenant se fermer."
            exit 0
        } catch {
            Write-Error "Erreur lors du redémarrage: $_"
            exit 1
        }
        "#;
        
        // Exécuter via PowerShell
        let output = match app.shell()
            .command("powershell")
            .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershell_command])
            .output()
            .await {
                Ok(output) => output,
                Err(e) => {
                    println!("Erreur lors de l'exécution de PowerShell: {}", e);
                    return Err(format!("Erreur lors de l'exécution de PowerShell: {}", e));
                }
            };
        
        success = output.status.success();
        
        if !success {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Échec du redémarrage: {}", error);
            return Err(format!("Échec du redémarrage: {}", error));
        }
    } else {
        // Redémarrer via Bash sur macOS/Linux
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
        
        success = output.status.success();
        
        if !success {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Échec du redémarrage: {}", error);
            return Err(format!("Échec du redémarrage: {}", error));
        }
    }
    
    // Si tout s'est bien passé, quitter l'application actuelle
    println!("Redémarrage programmé avec succès, fermeture de l'application...");
    app.exit(0);
    
    Ok(())
} 