use serde::{Deserialize, Serialize};
use std::result::Result;
use tauri::command;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
// Importer System depuis la racine et les traits depuis leurs sous-modules
// use sysinfo::System;
// use sysinfo::disk::DiskExt;
// use sysinfo::system::SystemExt;

// Structure pour les informations de disque (enrichie avec disk_number)
#[derive(Serialize, Debug, Clone)]
pub struct DiskInfo {
    disk_number: u32, // Ajouté pour l'identification
    name: String, // Utilisation de FriendlyName
    mount_point: String, // Vide pour l'instant
    total_space: u64,
    available_space: u64, // 0 pour l'instant
    file_system: String, // Vide pour l'instant
    is_removable: bool,
    // Ajouter d'autres infos si besoin (IsSystem, IsBoot...)
}

// Structure pour parser le JSON de Get-Disk
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsDisk {
    number: u32,
    friendly_name: String,
    size: u64,
    // is_system: bool,
    // is_boot: bool,
    is_removable: Option<bool>,
}

// Structure pour parser le JSON de Get-Partition
#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct PsPartition {
    partition_number: u32,
    drive_letter: Option<char>,
    size: u64,
    #[serde(rename = "Type")] // PowerShell utilise souvent "Type" directement
    partition_type: String, // Ex: Basic, GPT, MSR, etc.
}

// Structure finale pour les partitions
#[derive(Serialize, Debug, Clone)]
pub struct PartitionInfo {
    number: u32,
    drive_letter: Option<char>,
    size: u64,
    partition_type: String,
}

#[command]
pub async fn list_disks(app: AppHandle) -> Result<Vec<DiskInfo>, String> {
    println!("Real (PowerShell+Partitions): list_disks() called");

    // 1. Obtenir les disques physiques
    let disk_cmd = "Get-Disk | Select-Object Number, FriendlyName, Size, IsRemovable | ConvertTo-Json -Compress";
    let disk_output = app.shell().command("powershell").args(&["-Command", disk_cmd]).output().await
        .map_err(|e| format!("Erreur Get-Disk: {}", e))?;
    
    if !disk_output.status.success() { 
        return Err(format!("Get-Disk a échoué: {:?}", disk_output.status));
    }
    
    let disks_json_str = String::from_utf8_lossy(&disk_output.stdout);
    if disks_json_str.trim().is_empty() { 
        return Ok(vec![]); 
    }
    
    let parsed_disks: Vec<PsDisk> = if disks_json_str.trim().starts_with('[') {
        serde_json::from_str(&disks_json_str)
    } else {
        serde_json::from_str::<PsDisk>(&disks_json_str).map(|disk| vec![disk])
    }.map_err(|e| format!("Erreur parsing JSON disques: {}\nJSON: {}", e, disks_json_str))?;

    let mut final_disks = Vec::new();

    // 2. Pour chaque disque, obtenir les informations de volume (espace libre, système de fichiers)
    for ps_disk in parsed_disks {
        let mut mount_point = "".to_string();
        let mut available_space = 0u64;
        let mut file_system = "".to_string();
        
        println!("Traitement du disque {} : {}", ps_disk.number, ps_disk.friendly_name);
        
        // Récupérer les partitions avec lettres de lecteur pour ce disque
        let part_cmd = format!(
            "Get-Partition -DiskNumber {} | Where-Object {{ $_.DriveLetter -ne $null }} | Select-Object DriveLetter | ConvertTo-Json -Compress", 
            ps_disk.number
        );
        let part_output_res = app.shell().command("powershell").args(&["-Command", &part_cmd]).output().await;

        if let Ok(part_output) = part_output_res {
            if part_output.status.success() {
                let parts_json_str = String::from_utf8_lossy(&part_output.stdout);
                println!("Partitions JSON pour disque {} : {}", ps_disk.number, parts_json_str);
                
                if !parts_json_str.trim().is_empty() && parts_json_str.trim() != "null" {
                    #[derive(Deserialize)] 
                    struct PartLetter { 
                        #[serde(rename = "DriveLetter")] 
                        drive_letter: Option<char> 
                    }
                    
                    let parsed_parts: Result<Vec<PartLetter>, _> = if parts_json_str.trim().starts_with('[') {
                        serde_json::from_str(&parts_json_str)
                    } else {
                        serde_json::from_str::<PartLetter>(&parts_json_str).map(|p| vec![p])
                    };
                    
                    if let Ok(parts) = parsed_parts {
                        // Trouver la première partition avec une lettre
                        if let Some(part_with_letter) = parts.iter().find(|p| p.drive_letter.is_some()) {
                            let drive_letter = part_with_letter.drive_letter.unwrap();
                            mount_point = format!("{}:", drive_letter);
                            println!("Lettre de lecteur trouvée pour disque {} : {}", ps_disk.number, drive_letter);
                            
                            // Obtenir les informations du volume pour cette lettre de lecteur
                            let volume_cmd = format!(
                                "Get-Volume -DriveLetter {} | Select-Object FileSystem, SizeRemaining | ConvertTo-Json -Compress", 
                                drive_letter
                            );
                            let volume_output_res = app.shell().command("powershell").args(&["-Command", &volume_cmd]).output().await;
                            
                            if let Ok(volume_output) = volume_output_res {
                                if volume_output.status.success() {
                                    let volume_json_str = String::from_utf8_lossy(&volume_output.stdout);
                                    println!("Volume JSON pour lecteur {} : {}", drive_letter, volume_json_str);
                                    
                                    if !volume_json_str.trim().is_empty() && volume_json_str.trim() != "null" {
                                        #[derive(Deserialize)]
                                        struct VolumeInfo {
                                            #[serde(rename = "FileSystem")]
                                            file_system: Option<String>,
                                            #[serde(rename = "SizeRemaining")]
                                            size_remaining: Option<u64>,
                                        }
                                        
                                        if let Ok(volume_info) = serde_json::from_str::<VolumeInfo>(&volume_json_str) {
                                            available_space = volume_info.size_remaining.unwrap_or(0);
                                            file_system = volume_info.file_system.unwrap_or_else(|| "Inconnu".to_string());
                                            println!("Disque {} : espace libre = {} bytes, système = {}", 
                                                ps_disk.number, available_space, file_system);
                                        } else {
                                            println!("Erreur parsing volume JSON pour lecteur {} : {}", drive_letter, volume_json_str);
                                        }
                                    } else {
                                        println!("Volume JSON vide pour lecteur {}", drive_letter);
                                    }
                                } else {
                                    println!("Erreur Get-Volume pour lecteur {} : {:?}", drive_letter, volume_output.status);
                                }
                            } else {
                                println!("Erreur exécution Get-Volume pour lecteur {}", drive_letter);
                            }
                        } else {
                            println!("Aucune partition avec lettre de lecteur trouvée pour disque {}", ps_disk.number);
                        }
                    } else {
                        println!("Erreur parsing partitions JSON pour disque {} : {}", ps_disk.number, parts_json_str);
                    }
                } else {
                    println!("Aucune partition avec lettre trouvée pour disque {}", ps_disk.number);
                }
            } else {
                println!("Erreur Get-Partition pour disque {} : {:?}", ps_disk.number, part_output.status);
            }
        } else {
            println!("Erreur exécution Get-Partition pour disque {}", ps_disk.number);
        }

        final_disks.push(DiskInfo {
            disk_number: ps_disk.number,
            name: ps_disk.friendly_name,
            mount_point,
            total_space: ps_disk.size,
            available_space, // Maintenant récupéré via Get-Volume
            file_system, // Maintenant récupéré via Get-Volume
            is_removable: ps_disk.is_removable.unwrap_or(false),
        });
    }

    println!("Disques finaux trouvés : {} disques", final_disks.len());
    Ok(final_disks)
}

// --- Nouvelles commandes Nettoyage --- 

#[command]
pub async fn analyze_recycle_bin(app: AppHandle) -> Result<u64, String> {
    println!("Real: analyze_recycle_bin() called");

    // Commande PowerShell pour obtenir la taille de la corbeille de l'utilisateur courant
    let command = "try { ($Shell = New-Object -ComObject Shell.Application).NameSpace(0xa).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum } catch { 0 }";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution du calcul de taille de la corbeille: {}", e))?;

    if !output.status.success() {
        return Err(format!("Calcul taille corbeille a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    }

    // Parser la sortie (qui devrait être un nombre ou vide/0 si erreur/vide)
    let size_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let size_bytes: u64 = size_str.parse().unwrap_or(0);

    Ok(size_bytes)
}

#[command]
pub async fn clear_recycle_bin(app: AppHandle) -> Result<(), String> {
    println!("Real: clear_recycle_bin() called");

    // Commande PowerShell pour vider la corbeille de l'utilisateur courant
    // L'option -Force évite la confirmation dans PowerShell
    // Ne nécessite normalement PAS d'élévation pour la corbeille de l'utilisateur courant
    let command = "Clear-RecycleBin -Force";

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", command])
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Clear-RecycleBin: {}", e))?;

    if !output.status.success() {
        return Err(format!("Clear-RecycleBin a échoué: {:?} \nErreur: {}", 
            output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        Ok(())
    }
}

// --- Autres commandes Disks (restent placeholders ou implémentées) --- 

#[command]
pub async fn optimize_volume(app: AppHandle, drive_letter: String) -> Result<(), String> {
    println!("Real: optimize_volume(drive: '{}') called", drive_letter);

    // Extraire la lettre seule (ex: "C" de "C:")
    let letter = drive_letter.chars().next().ok_or_else(|| "Lettre de lecteur invalide".to_string())?;
    
    // Important: Nécessite des privilèges admin
    let command = format!("Optimize-Volume -DriveLetter {} -Verbose", letter);

    // Cette commande peut être longue, l'exécuter en arrière-plan?
    // Pour l'instant, on l'exécute en avant-plan.
    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) 
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Optimize-Volume: {}", e))?;

    if !output.status.success() {
        return Err(format!("Optimize-Volume pour '{}' a échoué: {:?} \nErreur: {}\nSortie: {}", 
            drive_letter,
            output.status, 
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&output.stdout)
        ));
    } else {
        println!("Optimize-Volume stdout: {}", String::from_utf8_lossy(&output.stdout));
        Ok(())
    }
}

#[command]
pub async fn run_defrag(_disk_name: String) -> Result<(), String> {
    // On remplace run_defrag par optimize_volume
    println!("Placeholder: run_defrag a été remplacé par optimize_volume");
    Err("Utilisez optimize_volume avec la lettre de lecteur.".to_string())
}

#[command]
pub async fn format_disk(app: AppHandle, drive_letter: String, file_system: String) -> Result<(), String> {
    println!("!!! ACTION DANGEREUSE !!! Real: format_disk(drive: '{}', fs: {}) called", drive_letter, file_system);
    
    // Valider FileSystem
    let fs = file_system.to_uppercase();
    if fs != "NTFS" && fs != "FAT32" && fs != "EXFAT" && fs != "REFS" {
        return Err("Système de fichiers non supporté (NTFS, FAT32, EXFAT, REFS)".to_string());
    }
    // Extraire lettre
     let letter = drive_letter.chars().next().ok_or_else(|| "Lettre de lecteur invalide".to_string())?;

    // Important: Nécessite des privilèges admin et est DESTRUCTEUR
    // Utiliser /q pour formatage rapide? Non par défaut pour sécurité.
    // Ajouter -Force pour ne pas demander confirmation dans PowerShell
    let command = format!("Format-Volume -DriveLetter {} -FileSystem {} -Force", letter, fs);

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) 
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Format-Volume: {}", e))?;

    if !output.status.success() {
        return Err(format!("Format-Volume pour '{}' a échoué: {:?} \nErreur: {}", 
            drive_letter, output.status, String::from_utf8_lossy(&output.stderr)));
    } else {
        Ok(())
    }
}

#[command]
pub async fn get_disk_partitions(app: AppHandle, disk_number: u32) -> Result<Vec<PartitionInfo>, String> {
    println!("Real (PowerShell): get_disk_partitions(disk_number: {}) called", disk_number);

    // Sélectionner les propriétés voulues et convertir en JSON
    let command = format!("Get-Partition -DiskNumber {} | Select-Object PartitionNumber, DriveLetter, Size, Type | ConvertTo-Json -Depth 3 -Compress", disk_number);
    println!("Commande PowerShell pour partitions: {}", command);

    let output = app.shell()
        .command("powershell")
        .args(&["-Command", &command]) // Utiliser & pour emprunter la commande formatée
        .output()
        .await
        .map_err(|e| format!("Erreur lors de l'exécution de Get-Partition pour disque {}: {}", disk_number, e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        println!("Get-Partition a échoué pour disque {} - Erreur: {}", disk_number, error_msg);
        return Err(format!("Get-Partition pour disque {} a échoué: {:?} \nErreur: {}", disk_number, output.status, error_msg));
    }

    let partitions_json_str = String::from_utf8_lossy(&output.stdout);
    println!("JSON partitions reçu pour disque {}: {}", disk_number, partitions_json_str);

    if partitions_json_str.trim().is_empty() {
        println!("Aucune partition trouvée pour disque {}", disk_number);
        return Ok(vec![]); // Pas de partitions trouvées
    }

    // Parser la sortie JSON (peut être un objet unique ou un tableau)
    let parsed_partitions: Vec<PsPartition> = if partitions_json_str.trim().starts_with('[') {
        serde_json::from_str(&partitions_json_str)
            .map_err(|e| format!("Erreur parsing JSON (tableau) partitions: {}\nJSON: {}", e, partitions_json_str))?
    } else {
        serde_json::from_str::<PsPartition>(&partitions_json_str)
            .map(|partition| vec![partition])
            .map_err(|e| format!("Erreur parsing JSON (objet unique) partitions: {}\nJSON: {}", e, partitions_json_str))?
    };

    println!("Partitions parsées pour disque {}: {} partitions trouvées", disk_number, parsed_partitions.len());

    // Mapper vers la structure finale
    let final_partitions = parsed_partitions.into_iter().map(|ps_part| {
        PartitionInfo {
            number: ps_part.partition_number,
            drive_letter: ps_part.drive_letter,
            size: ps_part.size,
            partition_type: ps_part.partition_type,
        }
    }).collect();

    println!("Partitions finales pour disque {}: {:?}", disk_number, final_partitions);
    Ok(final_partitions)
} 