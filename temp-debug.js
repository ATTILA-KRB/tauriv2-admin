console.log("Débogage de la page UpdatesPage");

// Vérifie si le composant UpdatesPage est correctement importé
try {
  const path = require('path');
  const fs = require('fs');
  
  const updatePagePath = path.join(__dirname, 'src', 'pages', 'UpdatesPage.tsx');
  const exists = fs.existsSync(updatePagePath);
  
  console.log(`Fichier UpdatesPage.tsx existe: ${exists}`);
  
  if (exists) {
    const content = fs.readFileSync(updatePagePath, 'utf8');
    const lines = content.split('\n');
    console.log(`Nombre de lignes dans le fichier: ${lines.length}`);
    
    // Cherche des erreurs de syntaxe évidentes
    try {
      // Vérifie s'il y a des accolades manquantes
      let openBraces = 0;
      let closeBraces = 0;
      for (const line of lines) {
        for (const char of line) {
          if (char === '{') openBraces++;
          if (char === '}') closeBraces++;
        }
      }
      
      console.log(`Accolades ouvrantes: ${openBraces}, fermantes: ${closeBraces}`);
      if (openBraces !== closeBraces) {
        console.log("ALERTE: Nombre inégal d'accolades ouvrantes et fermantes!");
      }
      
      // Vérifie si le composant est correctement exporté
      const hasDefaultExport = content.includes('export default UpdatesPage');
      console.log(`Contient export default: ${hasDefaultExport}`);
      
      // Vérifie les erreurs potentielles liées aux fonctions lambda et au thème
      const themeUsages = content.match(/theme\s*=>/g) || [];
      console.log(`Utilisations de theme =>: ${themeUsages.length}`);
      
    } catch (err) {
      console.error("Erreur lors de l'analyse du fichier:", err);
    }
  }
} catch (err) {
  console.error("Erreur:", err);
}

console.log("Fin du débogage"); 