import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const { themeMode } = useThemeStore();
  
  // Determina se usare dark mode
  const isDark = themeMode === 'auto' 
    ? systemColorScheme === 'dark'
    : themeMode === 'dark';
  
  // Ritorna i colori appropriati
  const colors = isDark ? Colors.dark : Colors.light;
  
  return {
    isDark,
    colors,
    themeMode,
  };
}

export type AppColors = typeof Colors.light;
