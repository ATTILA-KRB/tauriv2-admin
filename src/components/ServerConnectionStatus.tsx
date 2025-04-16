import React from 'react';

/**
 * Composant ServerConnectionStatus simplifié qui ne fait plus rien
 * Puisque l'application Tauri gère déjà sa propre communication frontend/backend
 * Ce composant est conservé pour compatibilité avec le code existant
 */
const ServerConnectionStatus: React.FC = () => {
  // Ne rien afficher, considérer que tout est toujours prêt
  return null;
};

export default ServerConnectionStatus; 