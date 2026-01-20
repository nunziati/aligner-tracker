/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#007AFF';
const tintColorDark = '#0A84FF';

export const Colors = {
  light: {
    // Base
    text: '#000000',
    textSecondary: '#6d6d72',
    textTertiary: '#8e8e93',
    background: '#f2f2f7',
    surface: '#ffffff',
    tint: tintColorLight,
    
    // Tab bar
    tabIconDefault: '#8e8e93',
    tabIconSelected: tintColorLight,
    tabBarBackground: '#ffffff',
    
    // Components
    cardBackground: '#ffffff',
    border: '#c6c6c8',
    separator: '#e5e5ea',
    
    // Status colors (rimangono uguali)
    success: '#2ecc71',
    successLight: '#e8f8f5',
    warning: '#e67e22',
    warningLight: '#fdf2e9',
    error: '#e74c3c',
    errorLight: '#fdedec',
    
    // Chart
    chartBar: '#4ADDBA',
    chartBarOver: '#FF7F7F',
    chartBarEmpty: '#e0e0e0',
    chartRule: '#f0f0f0',
    
    // Picker highlight
    pickerHighlight: 'rgba(0, 122, 255, 0.12)',
  },
  dark: {
    // Base
    text: '#ffffff',
    textSecondary: '#98989d',
    textTertiary: '#636366',
    background: '#000000',
    surface: '#1c1c1e',
    tint: tintColorDark,
    
    // Tab bar
    tabIconDefault: '#636366',
    tabIconSelected: tintColorDark,
    tabBarBackground: '#1c1c1e',
    
    // Components
    cardBackground: '#1c1c1e',
    border: '#38383a',
    separator: '#38383a',
    
    // Status colors
    success: '#30d158',
    successLight: '#0d2818',
    warning: '#ff9f0a',
    warningLight: '#2d1f0a',
    error: '#ff453a',
    errorLight: '#2d0f0e',
    
    // Chart
    chartBar: '#30d158',
    chartBarOver: '#ff453a',
    chartBarEmpty: '#38383a',
    chartRule: '#2c2c2e',
    
    // Picker highlight
    pickerHighlight: 'rgba(10, 132, 255, 0.2)',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
