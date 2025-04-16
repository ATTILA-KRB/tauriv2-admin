#!/bin/bash

# Script pour publier une nouvelle version sur GitHub

# Vérifier si git est installé
if ! command -v git &> /dev/null; then
    echo "Git n'est pas installé. Veuillez l'installer avant de continuer."
    exit 1
fi

# Vérifier que nous sommes dans un dépôt git
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo "Vous n'êtes pas dans un dépôt git. Exécutez ce script depuis la racine du projet."
    exit 1
fi

# Lire la version actuelle depuis Cargo.toml
CURRENT_VERSION=$(grep -m 1 'version = ' src-tauri/Cargo.toml | sed -E 's/version = "([^"]+)"/\1/g')
echo "Version actuelle: $CURRENT_VERSION"

# Demander la nouvelle version
read -p "Entrez la nouvelle version (laissez vide pour utiliser $CURRENT_VERSION): " NEW_VERSION
NEW_VERSION=${NEW_VERSION:-$CURRENT_VERSION}

# Créer le tag
TAG="v$NEW_VERSION"
echo "Création du tag $TAG..."

# Vérifier si le tag existe déjà
if git tag | grep -q "^$TAG$"; then
    echo "Le tag $TAG existe déjà."
    read -p "Voulez-vous supprimer le tag existant et le recréer? (y/n): " OVERWRITE
    if [[ $OVERWRITE == "y" || $OVERWRITE == "Y" ]]; then
        git tag -d $TAG
        git push origin :refs/tags/$TAG
    else
        echo "Opération annulée."
        exit 1
    fi
fi

# Ajouter le tag
git tag -a $TAG -m "Version $NEW_VERSION"
echo "Tag $TAG créé localement."

# Pousser le tag
echo "Poussée du tag vers GitHub..."
git push origin $TAG

echo "Tag $TAG poussé vers GitHub."
echo "Le workflow GitHub Actions devrait démarrer automatiquement."
echo "Vous pouvez vérifier le statut à l'adresse: https://github.com/ATTILA-KRB/tauriv2-admin/actions" 