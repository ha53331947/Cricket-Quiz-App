import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { useRouter } from 'expo-router';
import { supabase } from '../../supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const getRedirectUrl = () => {
    // Expo Go: exp://IP:PORT/--/ (Supabase mein exp://** allowed hai)
    const hostUri = Constants.expoConfig?.hostUri;
    if (Constants.executionEnvironment === 'storeClient' && hostUri) {
      return `exp://${hostUri}/--/`;
    }
    // APK / development build: app ki apni scheme
    return Linking.createURL('/');
  };

  const handleGoogleLogin = async () => {
    if (loading) return;

    try {
      setLoading(true);

      // ---------- WEB ----------
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
        return;
      }

      // ---------- MOBILE ----------
      const redirectUrl = getRedirectUrl();
      console.log('REDIRECT URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Google login URL nahi mili.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('AUTH RESULT TYPE:', result.type);

      // Browser band ho gaya ya cancel: check karo session ban chuki hai ya nahi
      if (result.type !== 'success' || !result.url) {
        await new Promise((r) => setTimeout(r, 800));
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          router.replace('/(drawer)');
        }
        return;
      }

      const url = result.url;
      console.log('CALLBACK URL:', url);

      const hashParams = new URLSearchParams(url.split('#')[1] || '');
      const queryParams = new URLSearchParams(
        url.split('?')[1]?.split('#')[0] || ''
      );

      const authError =
        queryParams.get('error_description') ||
        hashParams.get('error_description') ||
        queryParams.get('error') ||
        hashParams.get('error');
      if (authError) throw new Error(authError);

      const accessToken =
        hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken =
        hashParams.get('refresh_token') || queryParams.get('refresh_token');
      const code = queryParams.get('code') || hashParams.get('code');

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      } else if (code) {
        const { error: codeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (codeError) throw codeError;
      } else {
        throw new Error('Google se token ya code nahi mila.');
      }

      const { data: finalSession, error: finalError } =
        await supabase.auth.getSession();
      if (finalError) throw finalError;
      if (!finalSession.session) {
        throw new Error('Login ke baad session nahi mili. Dobara try karein.');
      }

      router.replace('/(drawer)');
    } catch (err: any) {
      console.log('Google login error:', err);
      Alert.alert('Google Login Error', err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.authContainer}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <Text style={styles.title}>CRICKET QUIZ</Text>
        <Text style={styles.subtitle}>APP</Text>

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#090d16" />
          ) : (
            <View style={styles.buttonContent}>
              <Image
                source={{
                  uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
                }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d2ff',
    letterSpacing: 5,
    marginTop: 2,
    marginBottom: 40,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    color: '#090d16',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});