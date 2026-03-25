import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/src/utils/supabase';
import { LoginScreen } from '@/src/screens/LoginScreens';

type AuthMode = 'signin' | 'signup';
type NoticeType = 'error' | 'success';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }
      if (error) {
        setNotice({ type: 'error', text: error.message });
        return;
      }
      setSession(data.session ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const onAuthWithEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setNotice({ type: 'error', text: 'Captura correo y contraseña.' });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          throw error;
        }
        setNotice({ type: 'success', text: 'Inicio de sesión exitoso.' });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (error) {
          throw error;
        }

        if (!data.session) {
          setNotice({
            type: 'success',
            text: 'Cuenta creada. Revisa tu correo para confirmar la cuenta.',
          });
        } else {
          setNotice({ type: 'success', text: 'Cuenta creada e inicio de sesión correcto.' });
        }
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    setLoading(true);
    setNotice(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setNotice({ type: 'success', text: 'Sesión cerrada.' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible cerrar sesión.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <View style={styles.background} />
      <View style={styles.container}>
        <Text style={styles.kicker}>Supabase Auth Demo</Text>
        <Text style={styles.title}>Login con correo y contraseña</Text>

        <View style={styles.card}>
          {session ? (
            <>
              <Text style={styles.sessionTitle}>Sesión iniciada</Text>
              <Text style={styles.sessionEmail}>{session.user.email}</Text>

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={onSignOut}
                style={[styles.primaryButton, loading && styles.buttonDisabled]}>
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Cerrar sesión</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.modeSwitcher}>
                <Pressable
                  onPress={() => setMode('signin')}
                  style={[
                    styles.modeButton,
                    mode === 'signin' ? styles.modeButtonActive : styles.modeButtonInactive,
                  ]}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      mode === 'signin' ? styles.modeButtonTextActive : styles.modeButtonTextInactive,
                    ]}>
                    Iniciar sesión
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('signup')}
                  style={[
                    styles.modeButton,
                    mode === 'signup' ? styles.modeButtonActive : styles.modeButtonInactive,
                  ]}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      mode === 'signup' ? styles.modeButtonTextActive : styles.modeButtonTextInactive,
                    ]}>
                    Registrarse
                  </Text>
                </Pressable>
              </View>

              <View style={styles.form}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Correo"
                  placeholderTextColor="#8B95A1"
                  style={styles.input}
                  value={email}
                />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  onChangeText={setPassword}
                  placeholder="Contraseña"
                  placeholderTextColor="#8B95A1"
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={onAuthWithEmail}
                style={[styles.primaryButton, loading && styles.buttonDisabled]}>
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
                  </Text>
                )}
              </Pressable>

              <LoginScreen/>
            </>
          )}
        </View>

        {notice ? (
          <View style={[styles.notice, notice.type === 'error' ? styles.noticeError : styles.noticeSuccess]}>
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  background: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 180,
    backgroundColor: '#D5E7FF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  kicker: {
    color: '#355D9A',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: '#0F172A',
    fontWeight: '800',
  },
  subtitle: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#EFF4FA',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    minHeight: 40,
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  modeButtonInactive: {
    backgroundColor: 'transparent',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#0F172A',
  },
  modeButtonTextInactive: {
    color: '#64748B',
  },
  form: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#0B63CE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  googleButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
  },
  googleButtonText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  notice: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  noticeError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  noticeSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  noticeText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionEmail: {
    fontSize: 15,
    color: '#334155',
  },
});
