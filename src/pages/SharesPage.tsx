import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '../components/PageLayout';
import HomeCard from '../components/HomeCard';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';

// Icons
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import LabelIcon from '@mui/icons-material/Label';
import DescriptionIcon from '@mui/icons-material/Description';
import ShareIcon from '@mui/icons-material/Share';
import RefreshIcon from '@mui/icons-material/Refresh';
import DriveNetworkIcon from '@mui/icons-material/DriveFileMove';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';

interface ShareInfo {
    name: string;
    path: string;
    description: string;
}

const SharesPage: React.FC = () => {
    const [shares, setShares] = useState<ShareInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // États création
    const [newName, setNewName] = useState("");
    const [newPath, setNewPath] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    // État pour la boîte de dialogue de suppression
    const [shareToDelete, setShareToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchShares = useCallback(() => {
        setIsLoading(true); 
        setError(null); 
        setActionMessage(null);
        
        invoke<ShareInfo[]>('list_shares')
            .then(data => setShares(data))
            .catch(err => setError(typeof err === 'string' ? err : 'Erreur inconnue.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => { 
        fetchShares(); 
    }, [fetchShares]);

    const handleCreateShare = (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true); 
        setActionMessage(null);
        
        invoke<void>('create_share', { 
            name: newName.trim(), 
            path: newPath.trim(), 
            description: newDesc.trim() || null 
        })
            .then(() => {
                setActionMessage({ type: 'success', message: `Partage '${newName}' créé avec succès.` });
                setNewName(""); 
                setNewPath(""); 
                setNewDesc("");
                fetchShares();
            })
            .catch(err => setActionMessage({ 
                type: 'error', 
                message: `Erreur lors de la création du partage: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` 
            }))
            .finally(() => setIsCreating(false));
    };

    const openDeleteDialog = (name: string) => {
        setShareToDelete(name);
    };

    const closeDeleteDialog = () => {
        setShareToDelete(null);
    };

    const handleDeleteShare = () => {
        if (!shareToDelete) return;
        
        setIsDeleting(true);
        setActionMessage(null);
        
        invoke<void>('delete_share', { name: shareToDelete })
            .then(() => {
                setActionMessage({ 
                    type: 'success', 
                    message: `Partage '${shareToDelete}' supprimé avec succès.` 
                });
                fetchShares();
                closeDeleteDialog();
            })
            .catch(err => setActionMessage({ 
                type: 'error', 
                message: `Erreur lors de la suppression du partage: ${typeof err === 'string' ? err : 'Erreur inconnue.'}` 
            }))
            .finally(() => setIsDeleting(false));
    };

    return (
        <PageLayout 
            title="Partages Réseau Locaux" 
            icon={<FolderSharedIcon />}
            description="Créez et gérez les partages réseau de votre ordinateur"
        >
            <Grid container spacing={3}>
                {/* Section Création de partage */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Créer un nouveau partage" 
                        icon={<ShareIcon />}
                        variant="gradient"
                        accentColor="#1976d2"
                        error={actionMessage?.type === 'error' ? actionMessage.message : null}
                    >
                        <Box component="form" onSubmit={handleCreateShare} sx={{ p: 3 }}>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Créez un nouveau partage réseau en spécifiant un nom, un chemin et une description optionnelle.
                            </Typography>
                            
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={4}>
                                    <TextField
                                        fullWidth
                                        required
                                        label="Nom du partage"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        disabled={isCreating}
                                        placeholder="Ex: Documents"
                                        size="small"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LabelIcon color="primary" />
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{ 
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px'
                                            }
                                        }}
                                    />
                                </Grid>
                                
                                <Grid item xs={12} sm={6} md={4}>
                                    <TextField
                                        fullWidth
                                        required
                                        label="Chemin du dossier"
                                        value={newPath}
                                        onChange={(e) => setNewPath(e.target.value)}
                                        disabled={isCreating}
                                        placeholder="Ex: C:\Documents"
                                        size="small"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <FolderIcon color="primary" />
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{ 
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px'
                                            }
                                        }}
                                    />
                                </Grid>
                                
                                <Grid item xs={12} sm={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Description (optionnelle)"
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        disabled={isCreating}
                                        placeholder="Ex: Documents partagés pour l'équipe"
                                        size="small"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <DescriptionIcon color="primary" />
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{ 
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '12px'
                                            }
                                        }}
                                    />
                                </Grid>
                                
                                <Grid item xs={12}>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2, mt: 1 }}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            color="primary"
                                            disabled={isCreating || !newName.trim() || !newPath.trim()}
                                            startIcon={isCreating ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                                            sx={{ 
                                                borderRadius: 2,
                                                py: 1,
                                                px: 3,
                                                transition: 'all 0.2s',
                                                '&:hover': { transform: 'translateY(-2px)' }
                                            }}
                                        >
                                            {isCreating ? "Création..." : "Créer le partage"}
                                        </Button>
                                        
                                        {actionMessage?.type === 'success' && (
                                            <Alert 
                                                severity="success" 
                                                sx={{ 
                                                    borderRadius: 2,
                                                    flexGrow: 1
                                                }}
                                            >
                                                {actionMessage.message}
                                            </Alert>
                                        )}
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>
                    </HomeCard>
                </Grid>
                
                {/* Section Liste des partages */}
                <Grid item xs={12}>
                    <HomeCard 
                        title="Partages existants" 
                        icon={<DriveNetworkIcon />}
                        variant="standard"
                        isLoading={isLoading && shares.length === 0}
                        error={error}
                        headerActions={
                            <Tooltip title="Rafraîchir la liste">
                                <IconButton 
                                    onClick={fetchShares} 
                                    disabled={isLoading}
                                    size="small"
                                    sx={{
                                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                                        '&:hover': {
                                            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,1)',
                                        }
                                    }}
                                >
                                    <RefreshIcon />
                                </IconButton>
                            </Tooltip>
                        }
                    >
                        <Box sx={{ p: 2 }}>
                            {isLoading && shares.length === 0 ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress size={40} />
                                </Box>
                            ) : shares.length === 0 ? (
                                <Box sx={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    gap: 2,
                                    p: 6,
                                    bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                    borderRadius: 3,
                                    border: theme => `1px dashed ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                    }`
                                }}>
                                    <FolderSpecialIcon sx={{ fontSize: 60, color: 'action.disabled' }} />
                                    <Typography variant="body1" color="text.secondary">
                                        Aucun partage réseau configuré actuellement.
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Utilisez le formulaire ci-dessus pour créer votre premier partage.
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer component={Paper} elevation={0} sx={{ 
                                    borderRadius: '12px',
                                    border: theme => `1px solid ${
                                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                                    }`
                                }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{ 
                                                bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                                                '& th': { fontWeight: 'bold' } 
                                            }}>
                                                <TableCell>Nom du partage</TableCell>
                                                <TableCell>Chemin</TableCell>
                                                <TableCell>Description</TableCell>
                                                <TableCell align="center">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {shares.map((share) => (
                                                <TableRow 
                                                    key={share.name}
                                                    hover
                                                    sx={{ 
                                                        '&:last-child td, &:last-child th': { border: 0 },
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <FolderSharedIcon color="primary" fontSize="small" />
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {share.name}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={share.path}
                                                            size="small"
                                                            variant="outlined"
                                                            icon={<FolderIcon fontSize="small" />}
                                                            sx={{ borderRadius: '8px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {share.description || (
                                                            <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                                                Aucune description
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title="Supprimer le partage">
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => openDeleteDialog(share.name)}
                                                                sx={{ 
                                                                    '&:hover': { 
                                                                        bgcolor: 'error.lighter',
                                                                        transform: 'scale(1.1)'
                                                                    }
                                                                }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </HomeCard>
                </Grid>

                {/* Information complémentaire */}
                <Grid item xs={12}>
                    <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                À propos des partages réseau
                            </Typography>
                            <Typography variant="body2">
                                Les partages réseau vous permettent de rendre des dossiers accessibles à d'autres utilisateurs sur votre réseau.
                                Assurez-vous que le chemin spécifié existe et que vous avez les permissions nécessaires pour le partager.
                                Les partages créés ici seront visibles par les autres ordinateurs du réseau via l'adresse <b>\\{window.location.hostname}\nom_du_partage</b>.
                            </Typography>
                        </Alert>
                    </Box>
                </Grid>
            </Grid>

            {/* Boîte de dialogue de confirmation de suppression */}
            <Dialog
                open={shareToDelete !== null}
                onClose={closeDeleteDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                PaperProps={{
                    sx: { borderRadius: '12px' }
                }}
            >
                <DialogTitle id="alert-dialog-title">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DeleteIcon color="error" />
                        <Typography variant="h6">Confirmer la suppression</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Êtes-vous sûr de vouloir supprimer le partage réseau <b>{shareToDelete}</b> ?
                        <br /><br />
                        Cette action supprimera uniquement le partage réseau, mais ne supprimera pas les fichiers physiques.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button 
                        onClick={closeDeleteDialog} 
                        color="primary" 
                        variant="outlined"
                        sx={{ borderRadius: '8px' }}
                    >
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleDeleteShare} 
                        color="error" 
                        variant="contained" 
                        disabled={isDeleting}
                        startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
                        autoFocus
                        sx={{ borderRadius: '8px' }}
                    >
                        {isDeleting ? "Suppression..." : "Supprimer"}
                    </Button>
                </DialogActions>
            </Dialog>
        </PageLayout>
    );
};

export default SharesPage; 