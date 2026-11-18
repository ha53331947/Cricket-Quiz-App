import React from 'react';
import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '../../components/CustomDrawerContent';
import { useTheme } from '../../context/ThemeContext';

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.text,
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.subText,
        drawerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{ title: 'Cricket Quiz Home' }}
      />
    </Drawer>
  );
}