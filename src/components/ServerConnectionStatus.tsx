import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * Composant pour gérer et afficher l'état de la connexion au serveur local
 * Affiche un indicateur de chargement pendant la tentative de connexion
 * Affiche un message d'erreur si la connexion échoue
 * Permet de retenter la connexion
 */
const ServerConnectionStatus: React.FC = () => {
  // États
  const [isServerReady, setIsServerReady] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Fonction pour vérifier si le serveur est prêt
  const checkServerStatus = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      // Vérifier si le serveur est prêt via l'API Tauri
      const ready = await invoke<boolean>('is_server_ready');
      setIsServerReady(ready);
      
      if (ready) {
        // Si le serveur est prêt, obtenir le port
        const port = await invoke<number>('get_server_port');
        setServerPort(port);
        
        // Faire une requête test pour vérifier la connexion
        try {
          const response = await fetch(`http://localhost:${port}/api/status`);
          if (!response.ok) {
            throw new Error(`Erreur de connexion au serveur: ${response.statusText}`);
          }
          const data = await response.json();
          console.log('Connexion au serveur réussie:', data);
        } catch (fetchError) {
          console.error('Erreur lors de la vérification de la connexion:', fetchError);
          setError(`Erreur de connexion: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          setIsServerReady(false);
        }
      } else {
        // Si le serveur n'est pas prêt, attendre un peu et réessayer
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prevCount => prevCount + 1);
            checkServerStatus();
          }, 2000); // Attendre 2 secondes avant de réessayer
        } else {
          setError("Le serveur n'a pas pu démarrer après plusieurs tentatives. Veuillez redémarrer l'application.");
        }
      }
    } catch (err) {
      console.error('Erreur lors de la vérification du statut du serveur:', err);
      setError(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
      setIsServerReady(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Écouter l'événement "server-ready" de Tauri
  useEffect(() => {
    const unlisten = listen('server-ready', (event) => {
      console.log('Événement server-ready reçu:', event);
      setServerPort(event.payload as number);
      setIsServerReady(true);
      setIsChecking(false);
    });

    // Écouter l'événement "server-error" de Tauri
    const unlistenError = listen('server-error', (event) => {
      console.error('Événement server-error reçu:', event);
      setError(`Erreur du serveur: ${event.payload}`);
      setIsServerReady(false);
      setIsChecking(false);
    });

    // Vérifier le statut du serveur au chargement
    checkServerStatus();

    // Nettoyer les écouteurs d'événements
    return () => {
      unlisten.then(fn => fn());
      unlistenError.then(fn => fn());
    };
  }, []);

  // Fonction pour retenter la connexion
  const handleRetryConnection = () => {
    setRetryCount(0);
    checkServerStatus();
  };

  // Si le serveur est prêt, ne rien afficher
  if (isServerReady && !error) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        zIndex: 9999,
        p: 3,
      }}
    >
      {isChecking ? (
        <>
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h5" sx={{ mb: 2 }}>
            Connexion au serveur local...
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Veuillez patienter pendant que nous établissons la connexion.
          </Typography>
        </>
      ) : error ? (
        <>
          <WifiOffIcon color="error" sx={{ fontSize: 60, mb: 3 }} />
          <Typography variant="h5" sx={{ mb: 2 }}>
            Problème de connexion
          </Typography>
          <Alert severity="error" sx={{ mb: 3, maxWidth: 500 }}>
            {error}
          </Alert>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 600, textAlign: 'center' }}>
            L'application n'a pas pu se connecter au serveur local. Cela peut être dû à un problème réseau ou à un conflit de port.
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleRetryConnection}
          >
            Réessayer la connexion
          </Button>
        </>
      ) : (
        <>
          <WifiIcon color="warning" sx={{ fontSize: 60, mb: 3 }} />
          <Typography variant="h5" sx={{ mb: 2 }}>
            En attente du serveur local
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Le serveur local est en cours de démarrage. Veuillez patienter...
          </Typography>
        </>
      )}
    </Box>
  );
};

export default ServerConnectionStatus; 