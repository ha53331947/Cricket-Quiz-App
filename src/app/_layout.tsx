
import React, { useState, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../../supabase';
import { ThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.log('SESSION ERROR:', error.message);
        }

        setSession(data.session);
      } catch (error) {
        console.log('AUTH INITIALIZATION ERROR:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const currentRoute = segments[0];

    const inLogin = currentRoute === 'login';
    const inDrawer = currentRoute === '(drawer)';

    // User is not logged in: always show login
    if (!session && !inLogin) {
      router.replace('/login');
    }

    // User is logged in: always enter drawer
    else if (session && !inDrawer) {
      router.replace('/(drawer)');
    }
  }, [session, loading, segments, router]);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#00d2ff" />
          </View>
        )}
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
});