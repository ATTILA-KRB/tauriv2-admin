# Script PowerShell pour publier une nouvelle version sur GitHub

# Vérifier si git est installé
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git n'est pas installé. Veuillez l'installer avant de continuer." -ForegroundColor Red
    exit 1
}

# Vérifier que nous sommes dans un dépôt git
try {
    $null = git rev-parse --is-inside-work-tree
}
catch {
    Write-Host "Vous n'êtes pas dans un dépôt git. Exécutez ce script depuis la racine du projet." -ForegroundColor Red
    exit 1
}

# Lire la version actuelle depuis Cargo.toml
$cargoToml = Get-Content -Path "src-tauri/Cargo.toml"
$versionLine = $cargoToml | Where-Object { $_ -match "^version\s*=\s*`"([^`"]+)`"" }
if ($versionLine -match "version\s*=\s*`"([^`"]+)`"") {
    $CURRENT_VERSION = $matches[1]
    Write-Host "Version actuelle: $CURRENT_VERSION" -ForegroundColor Cyan
}
else {
    Write-Host "Impossible de trouver la version actuelle dans Cargo.toml" -ForegroundColor Red
    exit 1
}

# Demander la nouvelle version
$NEW_VERSION = Read-Host "Entrez la nouvelle version (laissez vide pour utiliser $CURRENT_VERSION)"
if ([string]::IsNullOrWhiteSpace($NEW_VERSION)) {
    $NEW_VERSION = $CURRENT_VERSION
}

# Créer le tag
$TAG = "v$NEW_VERSION"
Write-Host "Création du tag $TAG..." -ForegroundColor Cyan

# Vérifier si le tag existe déjà
$existingTags = git tag
if ($existingTags -contains $TAG) {
    Write-Host "Le tag $TAG existe déjà." -ForegroundColor Yellow
    $OVERWRITE = Read-Host "Voulez-vous supprimer le tag existant et le recréer? (y/n)"
    if ($OVERWRITE -eq "y" -or $OVERWRITE -eq "Y") {
        git tag -d $TAG
        git push origin ":refs/tags/$TAG"
    }
    else {
        Write-Host "Opération annulée." -ForegroundColor Red
        exit 1
    }
}

# Ajouter le tag
git tag -a $TAG -m "Version $NEW_VERSION"
Write-Host "Tag $TAG créé localement." -ForegroundColor Green

# Pousser le tag
Write-Host "Poussée du tag vers GitHub..." -ForegroundColor Cyan
git push origin $TAG

Write-Host "Tag $TAG poussé vers GitHub." -ForegroundColor Green
Write-Host "Le workflow GitHub Actions devrait démarrer automatiquement." -ForegroundColor Green
Write-Host "Vous pouvez vérifier le statut à l'adresse: https://github.com/ATTILA-KRB/tauriv2-admin/actions" -ForegroundColor Cyan 