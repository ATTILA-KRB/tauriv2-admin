# ADMIN-TOOL 🛠️

Interface d'administration Windows complète développée avec React, TypeScript et Tauri, offrant une solution moderne et sécurisée pour la gestion système Windows.

## 📋 Fonctionnalités

- **Gestion des Disques**
  - Analyse et nettoyage de la corbeille
  - Optimisation des volumes
  - Formatage des disques
  - Gestion des partitions

- **Gestion des Processus et Services**
  - Liste et contrôle des processus
  - Gestion des services Windows
  - Surveillance des ressources système

- **Administration Réseau**
  - Gestion des adaptateurs réseau
  - Configuration des paramètres réseau
  - Surveillance du trafic

- **Gestion des Utilisateurs**
  - Gestion des utilisateurs locaux
  - Gestion des groupes
  - Contrôle des permissions

- **Sécurité**
  - Gestion du pare-feu
  - Surveillance antivirus
  - Gestion des règles de sécurité

- **Maintenance Système**
  - Gestion des mises à jour Windows
  - Points de restauration système
  - Planification des tâches
  - Visualisation des événements système

- **Active Directory**
  - Gestion des utilisateurs et groupes AD
  - Gestion des ordinateurs
  - Mise à jour des stratégies de groupe
  - Réinitialisation des mots de passe

## 🚀 Installation

```bash
# Cloner le repository
git clone [URL_DU_REPO]

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev

# Construire pour la production
npm run build
```

## 🔧 Prérequis

- Windows 10/11
- Droits administrateur
- Node.js 18+
- Rust (pour le développement)

## 🛡️ Sécurité

L'application nécessite des droits administrateur pour fonctionner pleinement. Elle utilise :
- Une élévation de privilèges via UAC
- Une authentification sécurisée
- Un chiffrement des communications

## 🔄 Mises à jour

L'application inclut un système de mise à jour automatique pour :
- Les correctifs de sécurité
- Les nouvelles fonctionnalités
- Les améliorations de performance

## 🛠️ Technologies

- React 19
- TypeScript
- Tauri 2
- Material-UI 7
- Rust

## 📝 Version

Version actuelle : 0.1.0

## 📄 Licence

MIT License - Voir le fichier [LICENSE](LICENSE) pour plus de détails.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
