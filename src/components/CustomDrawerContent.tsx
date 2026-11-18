import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';

import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';

import { supabase } from '../../supabase';
import { Session } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';

export default function CustomDrawerContent(props: any) {
  const [session, setSession] = useState<Session | null>(null);
  const { isDarkMode, toggleTheme, colors } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      if (error) {
        Alert.alert('Logout Error', error.message);
      }
    } catch (err: any) {
      Alert.alert(
        'Logout Error',
        err.message || 'Something went wrong'
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      {/* Theme Toggle */}
      <View
        style={[
          styles.topContainer,
          { borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.themeLabel, { color: colors.text }]}>
          {isDarkMode ? '🌙 Night Theme' : '☀️ Day Theme'}
        </Text>

        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme}
          trackColor={{ false: '#767577', true: '#00d2ff' }}
          thumbColor={isDarkMode ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      {/* Profile Section */}
      <View style={styles.headerContainer}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="cover"
        />

        <Text style={[styles.hiText, { color: colors.text }]}>
          Hi!
        </Text>

        <Text style={[styles.emailText, { color: colors.accent }]}>
          {session?.user?.email || 'user@gmail.com'}
        </Text>
      </View>

      {/* Divider */}
      <View
        style={[
          styles.divider,
          {
            backgroundColor: isDarkMode
              ? '#374151'
              : '#d1d5db',
          },
        ]}
      />

      {/* Drawer Items */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Logout Button */}
      <View
        style={[
          styles.logoutContainer,
          { borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: colors.accent },
          ]}
          onPress={handleLogout}
        >
          <Text
            style={[
              styles.logoutText,
              {
                color: isDarkMode ? '#090d16' : '#ffffff',
              },
            ]}
          >
            Logout
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topContainer: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 25,
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 32,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  hiText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emailText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
