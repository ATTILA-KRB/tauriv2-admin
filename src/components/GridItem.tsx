import React from 'react';
import { Grid, GridProps } from '@mui/material';
import { ElementType } from 'react';

// Ce composant wrapper résout les problèmes de typage avec Grid item dans MUI v7
interface GridItemProps extends Omit<GridProps, 'component'> {
  children: React.ReactNode;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

const GridItem: React.FC<GridItemProps> = (props) => {
  const { children, ...rest } = props;
  
  // On utilise explicitement un div comme composant de base
  // et on passe toutes les autres props
  return (
    <Grid component={'div' as ElementType} {...rest}>
      {children}
    </Grid>
  );
};

export default GridItem; 