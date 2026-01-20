import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function TabLayout() {
  const { colors, isDark } = useAppTheme();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.separator,
        },
        headerShown: false,
      }}>
      
      {/* Tab 1: Tracker (Home) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'timer' : 'timer-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Tab 2: History */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Storico',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Tab 3: Piano */}
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Piano',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Tab 4: Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Impostazioni',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}