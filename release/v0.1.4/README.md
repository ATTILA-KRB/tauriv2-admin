# KRB_Tool v0.1.4 - Release Notes

## 📦 Fichiers d'Installation

Cette release contient plusieurs options d'installation pour Windows :

### Installateur MSI (Recommandé)
- **Fichier:** `KRB_Tool_0.1.4_x64_en-US.msi`
- **Taille:** ~4.8 MB
- **Installation:** Double-clic pour installer via Windows Installer
- **Avantages:** Installation propre, désinstallation facile via Panneau de Configuration

### Installateur NSIS
- **Fichier:** `KRB_Tool_0.1.4_x64-setup.exe`
- **Taille:** ~3.2 MB
- **Installation:** Assistant d'installation classique
- **Avantages:** Installation rapide avec choix de répertoire

### Exécutable Portable
- **Fichier:** `krb_tool.exe`
- **Taille:** ~12 MB
- **Usage:** Exécution directe sans installation
- **Avantages:** Portable, pas d'impact sur le système

## 🆕 Nouveautés v0.1.4

### ✨ Fonctionnalités Majeures
- **Détection réseau avancée** : 7 méthodes de détection des lecteurs réseau
- **Pagination EventViewer** : Options 10/25/50/100 éléments par page (défaut: 10)
- **Recherche EventViewer** : Recherche dans les messages d'événements
- **Informations disques précises** : Espace libre réel via `Get-Volume`
- **Tâches planifiées améliorées** : États détaillés et gestion d'erreurs

### 🐛 Corrections Importantes
- Parsing JSON corrigé pour les tâches planifiées (erreur "integer expected string")
- Gestion des codes d'état numériques pour les tâches
- Affichage correct de l'espace libre des disques
- Amélioration de la détection des ressources réseau

### 🎨 Interface Harmonisée
- Padding uniforme (3) sur toutes les cartes
- Bordures arrondies standardisées (12px cartes, 8px boutons)
- Espacement cohérent entre éléments
- Effets de survol améliorés
- Reset automatique de pagination lors des changements de filtres

## 🔧 Prérequis Système

- **OS:** Windows 10/11 (64-bit)
- **Privilèges:** Administrateur recommandé pour toutes les fonctionnalités
- **PowerShell:** Version 5.1+ (intégré dans Windows)
- **Modules optionnels:** PSWindowsUpdate (pour mises à jour Windows)

## 📋 Installation

### Via MSI (Recommandé)
1. Télécharger `KRB_Tool_0.1.4_x64_en-US.msi`
2. Double-cliquer sur le fichier
3. Suivre l'assistant d'installation
4. Lancer depuis le menu Démarrer ou bureau

### Via NSIS Setup
1. Télécharger `KRB_Tool_0.1.4_x64-setup.exe`
2. Exécuter en tant qu'administrateur
3. Choisir le répertoire d'installation
4. Lancer l'application installée

### Mode Portable
1. Télécharger `krb_tool.exe`
2. Placer dans un dossier de votre choix
3. Exécuter en tant qu'administrateur

## 🛠️ Modules Disponibles

- **💾 Disques** : Gestion et surveillance des disques (espace libre réel)
- **🌐 Réseau** : Configuration réseau et lecteurs mappés (7 méthodes détection)
- **👥 Utilisateurs** : Gestion des comptes utilisateurs
- **🔒 Sécurité** : Surveillance antivirus et pare-feu
- **🔄 Mises à jour** : Windows Update et historique (avec PSWindowsUpdate)
- **💼 Services** : Gestion des services Windows
- **📋 Tâches** : Tâches planifiées avec états détaillés
- **📊 Événements** : Visionneuse d'événements avec pagination et recherche
- **🗂️ Partages** : Ressources réseau et lecteurs mappés
- **🎛️ Matériel** : Informations système et composants

## 🐞 Support

Pour reporter des bugs ou demander de l'aide :
- Créer une issue sur le repository GitHub
- Inclure les logs d'erreur si disponibles
- Préciser la version Windows et les privilèges utilisés

---
**Version:** 0.1.4  
**Date:** Janvier 2025  
**Architecture:** x64  
**Langue:** Français/Anglais 