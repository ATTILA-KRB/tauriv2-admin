use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt; // Pour exécuter des commandes shell
use std::env; // Pour obtenir le chemin de l'exécutable

#[command]
pub async fn is_elevated() -> Result<bool, String> {
    // Utiliser la crate is_elevated
    Ok(is_elevated::is_elevated())
}

#[command]
pub async fn require_admin(app: AppHandle) -> Result<(), String> {
    let is_admin = is_elevated::is_elevated();
    println!("require_admin called. Is admin? {}", is_admin);

    if is_admin {
        println!("Déjà élevé, aucune action nécessaire.");
        Ok(())
    } else {
        println!("Nécessite élévation, tentative de redémarrage avec runas...");
        
        // Obtenir le chemin de l'exécutable actuel
        let current_exe = env::current_exe()
            .map_err(|e| format!("Impossible d'obtenir le chemin de l'exécutable: {}", e))?;
        let exe_path = current_exe.to_string_lossy().to_string();

        // Utiliser PowerShell pour relancer avec élévation (déclenche l'UAC)
        let command = format!("Start-Process -FilePath \"{}\" -Verb RunAs", exe_path);

        let output = app.shell()
            .command("powershell")
            .args(&["-Command", &command])
            .output()
            .await
            .map_err(|e| format!("Erreur lors de la tentative d'élévation via PowerShell: {}", e))?;

        if output.status.success() {
            println!("Demande d'élévation lancée. Fermeture de l'instance actuelle.");
            // Quitter l'application non élevée car une instance élevée devrait démarrer.
            app.exit(0);
            // Note: Le code après app.exit() ne sera probablement pas exécuté.
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // L'échec ici peut signifier que l'utilisateur a refusé l'UAC ou une autre erreur
            println!("Échec de Start-Process -Verb RunAs: {:?} - Erreur: {}", output.status, stderr);
            Err(format!("Échec de la demande d'élévation des privilèges (refus UAC ou erreur): {}", stderr))
        }
    }
} 