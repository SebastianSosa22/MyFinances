import { useWindowDimensions } from 'react-native';

// Escritorio (>= 900 px): barra lateral y varias columnas
export const useWide = () => useWindowDimensions().width >= 900; // escritorio: barra lateral y columnas
