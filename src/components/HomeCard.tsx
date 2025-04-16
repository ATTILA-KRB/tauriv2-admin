import React, { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

interface HomeCardProps {
    title: string;
    icon: React.ReactElement;
    children: ReactNode;
    isLoading?: boolean;
    error?: string | null;
    avatarColor?: string;
    footerActions?: React.ReactNode;
    headerActions?: React.ReactNode;
    accentColor?: string; // Couleur pour les accents
    variant?: 'standard' | 'gradient' | 'outlined';
    minHeight?: number | string;
}

/**
 * Carte personnalisée pour la page d'accueil
 */
const HomeCard: React.FC<HomeCardProps> = ({
    title,
    icon,
    children,
    isLoading = false,
    error = null,
    avatarColor = 'primary.main',
    footerActions,
    headerActions,
    accentColor = 'primary.main',
    variant = 'standard',
    minHeight
}) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    
    // Déterminer le fond en fonction du variant
    let cardBackground = 'background.paper';
    if (variant === 'gradient') {
        cardBackground = isDarkMode 
            ? 'linear-gradient(135deg, #1a1f2c 0%, #2c3345 100%)' 
            : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%)';
    }
    
    // Déterminer la bordure
    const borderStyle = variant === 'outlined'
        ? `1px solid ${accentColor}` 
        : isDarkMode 
            ? '1px solid rgba(255,255,255,0.1)' 
            : 'none';
    
    // Couleurs et ombres adaptées au mode
    const shadowStyle = isDarkMode 
        ? '0 8px 24px rgba(0,0,0,0.3)' 
        : '0 8px 16px rgba(0,0,0,0.1)';
        
    const avatarShadow = isDarkMode 
        ? '0 4px 8px rgba(0,0,0,0.3)' 
        : '0 4px 8px rgba(0,0,0,0.1)';
    
    return (
        <Card 
            elevation={3} 
            sx={{ 
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                transition: 'all 0.3s ease', 
                '&:hover': { 
                    transform: 'translateY(-4px)',
                    boxShadow: shadowStyle
                },
                minHeight: minHeight || 'auto',
                background: cardBackground,
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                border: borderStyle,
                height: '100%'
            }}
        >
            {/* Accent de couleur en haut de la carte */}
            <Box 
                sx={{ 
                    height: '4px', 
                    width: '100%', 
                    background: typeof accentColor === 'string' ? accentColor : 'primary.main',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1
                }}
            />
            
            <CardHeader
                avatar={
                    <Avatar sx={{ 
                        bgcolor: avatarColor,
                        boxShadow: avatarShadow,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'scale(1.05)'
                        }
                    }}>
                        {icon}
                    </Avatar>
                }
                title={
                    <Typography variant="h6" sx={{ 
                        fontWeight: 'bold',
                        fontSize: '1.125rem',
                        color: 'text.primary'
                    }}>
                        {title}
                    </Typography>
                }
                action={headerActions}
                sx={{ 
                    pb: 1,
                    pt: 2.5 // Espace pour l'accent en haut
                }}
            />
            
            <Divider sx={{ 
                opacity: 0.5,
                mx: 2
            }} />
            
            <CardContent sx={{ 
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
            }}>
                {isLoading && (
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.03)',
                        zIndex: 10,
                        borderRadius: 1
                    }}>
                        <CircularProgress 
                            size={36} 
                            sx={{ 
                                color: typeof accentColor === 'string' ? accentColor : 'primary.main' 
                            }} 
                        />
                    </Box>
                )}
                
                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ 
                            mb: 2, 
                            borderRadius: 2,
                            boxShadow: isDarkMode 
                                ? '0 2px 8px rgba(0,0,0,0.2)' 
                                : '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                    >
                        {error}
                    </Alert>
                )}
                
                <Box sx={{ 
                    transition: 'opacity 0.3s ease',
                    opacity: isLoading ? 0.7 : 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {children}
                </Box>
            </CardContent>
            
            {footerActions && (
                <>
                    <Divider sx={{ opacity: 0.5, mx: 2 }} />
                    <CardActions sx={{ 
                        justifyContent: 'flex-end',
                        p: 2,
                        bgcolor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)'
                    }}>
                        {footerActions}
                    </CardActions>
                </>
            )}
        </Card>
    );
};

export default HomeCard; 