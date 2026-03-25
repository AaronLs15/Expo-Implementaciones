import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../utils/supabase';

export default function AuthCallback() {
  const [message, setMessage] = useState('Completando inicio de sesión...');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }

    const completeAuth = async () => {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get('code');
      const errorFromQuery =
        currentUrl.searchParams.get('error_description') || currentUrl.searchParams.get('error');

      if (errorFromQuery) {
        throw new Error(errorFromQuery);
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          throw error;
        }
        window.history.replaceState({}, document.title, '/');
        router.replace('/');
        return;
      }

      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          throw error;
        }
        window.history.replaceState({}, document.title, '/');
        router.replace('/');
        return;
      }

      throw new Error('No se recibió code ni tokens en el callback.');
    };

    completeAuth().catch((error) => {
      const fallback = 'No fue posible completar el login con Google.';
      setMessage(error instanceof Error ? error.message || fallback : fallback);
    });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#334155',
  },
});
