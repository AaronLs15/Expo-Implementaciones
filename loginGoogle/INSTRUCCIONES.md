# Integración de Auth con Supabase en Expo (Correo/Contraseña + Google)


Objetivo de esta guía:
- Dejar funcionando `registro` e `inicio de sesión` con correo y contraseña.
- Dejar funcionando `inicio de sesión con Google` en Web y Mobile.
- Entender para qué sirve cada archivo y cada función importante.

Este proyecto usa:
- Expo + React Native + TypeScript
- Expo Router
- Supabase Auth

---

## 1. Qué debes tener antes de empezar

1. Node.js instalado (recomendado LTS).
2. Proyecto de Supabase creado.
3. Cuenta de Google Cloud para configurar OAuth.
4. Dependencias instaladas en el proyecto.

Instalar dependencias (si aún no lo hiciste):

```bash
npm install
npx expo install @supabase/supabase-js react-native-url-polyfill expo-auth-session expo-web-browser expo-linking
```

---

## 2. Estructura real de este proyecto (archivos clave)

```txt
app/
  _layout.tsx                # Define navegación principal con Expo Router
  index.tsx                  # Pantalla principal con login/registro por correo y botón Google
  auth/
    callback.tsx             # Ruta web /auth/callback (reexporta el callback real)

src/
  utils/
    supabase.ts              # Cliente de Supabase (SDK)
  auth/
    redirect.ts              # Construye redirect URL para web/mobile
    signInWithGoogle.ts      # Inicia OAuth con Google
    callback.tsx             # Completa la autenticación al volver de Google
    useSession.ts            # Hook para leer sesión activa + signOut helper
  screens/
    LoginScreens.tsx         # Botón visual "Iniciar Sesión con Google"
```

---

## 3. Configuración de `app.json` (deep links en mobile)

El proyecto ya tiene esto:

- `scheme: "logingoogle"`

Eso permite redirecciones tipo:
- `logingoogle://auth/callback`

Archivo actual:
- `app.json`

Importante:
- Si cambias `scheme`, en mobile debes reconstruir la app (development build o release build).

---

## 4. Configuración en Supabase

### 4.1 Activar proveedor Google

En Supabase:
1. Ve a `Authentication` -> `Providers`.
2. Abre `Google`.
3. Activa el provider (`Enable`).
4. Pega `Client ID` y `Client Secret` que crearás en Google Cloud.

### 4.2 Redirect URLs permitidas (Allow list)

En Supabase:
1. Ve a `Authentication` -> `URL Configuration`.
2. En `Redirect URLs` agrega las rutas exactas que usará tu app.

Para este proyecto agrega, como mínimo:

- Mobile:
  - `logingoogle://auth/callback`
- Web local (usa el puerto real que te muestre Expo):
  - `http://localhost:8081/auth/callback`

Si tu Expo web arranca en otro puerto, agrega también ese valor exacto.

---

## 5. Configuración en Google Cloud

En Google Cloud Console:
1. Ve a `APIs & Services` -> `Credentials`.
2. Crea un `OAuth Client ID` (tipo Web application).
3. En `Authorized redirect URIs` agrega el callback de Supabase:
   - `https://<PROJECT-REF>.supabase.co/auth/v1/callback`

Notas:
- `<PROJECT-REF>` lo tomas de tu URL de proyecto Supabase.
- Ese callback es entre Google y Supabase.
- Luego Supabase redirige a tu `redirectTo` (tu app web o deep link mobile).

---

## 6. Variables de entorno (`.env`)

Este proyecto usa estas variables (nombres exactos):

```env
EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT-REF>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<SUPABASE_ANON_KEY>
```

Dónde se usan:
- En `src/utils/supabase.ts`

Importante:
- `EXPO_PUBLIC_` expone el valor al cliente (es correcto para la anon key).
- Nunca pongas la `service_role key` en app cliente.

---

## 7. Cliente de Supabase (`src/utils/supabase.ts`)

Código actual (resumen):

```ts
import 'react-native-url-polyfill/auto'
import { createClient, processLock } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  }
)
```

Para qué sirve cada opción:
- `autoRefreshToken: true`
  - Renueva tokens automáticamente antes de expirar.
- `persistSession: true`
  - Mantiene la sesión guardada para no loguearte en cada reinicio.
- `detectSessionInUrl: false`
  - Evita que el SDK intente procesar callback automáticamente.
  - En este proyecto lo procesamos manualmente en `src/auth/callback.tsx`.
- `lock: processLock`
  - Evita condiciones de carrera en refresco de sesión (importante en entornos RN/web).

---

## 8. Login con correo y contraseña (`app/index.tsx`)

La pantalla principal ya implementa:

1. `Iniciar sesión` con `supabase.auth.signInWithPassword`.
2. `Registrarse` con `supabase.auth.signUp`.
3. `Cerrar sesión` con `supabase.auth.signOut`.
4. Escucha de cambios de sesión con `supabase.auth.onAuthStateChange`.

Funciones clave dentro de `app/index.tsx`:

- `onAuthWithEmail()`
  - Valida email/password.
  - Si modo = `signin`, ejecuta `signInWithPassword`.
  - Si modo = `signup`, ejecuta `signUp`.
  - Muestra mensajes de éxito/error en UI.

- `onSignOut()`
  - Cierra sesión actual con `supabase.auth.signOut()`.

- `useEffect(...)` inicial
  - Llama `supabase.auth.getSession()` para leer sesión al montar.
  - Se suscribe a `onAuthStateChange` para mantener UI sincronizada.

---

## 9. Login con Google: flujo completo

### 9.1 Construcción del redirect (`src/auth/redirect.ts`)

```ts
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

export function getRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: Platform.OS === 'web' ? undefined : 'logingoogle',
    path: 'auth/callback'
  })
}
```

Qué hace:
- En `web`, genera URL tipo `http://localhost:PUERTO/auth/callback`.
- En `mobile`, genera `logingoogle://auth/callback`.

### 9.2 Arranque de OAuth (`src/auth/signInWithGoogle.ts`)

Flujo de la función `signInWithGoogle()`:

1. Obtiene `redirectTo` con `getRedirectUri()`.
2. Llama:
   - `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
3. Si plataforma web:
   - `window.location.assign(data.url)` para salir a Google.
4. Si plataforma mobile:
   - `WebBrowser.openAuthSessionAsync(data.url, redirectTo)`
   - Si vuelve con `result.url`, extrae `code`.
   - Intercambia `code` por sesión:
     - `supabase.auth.exchangeCodeForSession(code)`

Por qué se hace así:
- Web depende de redirección de navegador.
- Mobile necesita una sesión de navegador controlada para volver por deep link.

### 9.3 Botón de Google (`src/screens/LoginScreens.tsx`)

La función `LoginScreen()` renderiza un botón que ejecuta `signInWithGoogle` al presionar.

Ese componente se usa dentro de `app/index.tsx`.

---

## 10. Callback de Google en Expo Router

Este fue el ajuste clave para evitar `Unmatched Route`.

### 10.1 Ruta de Expo Router

Archivo:
- `app/auth/callback.tsx`

Contenido:
- Reexporta el callback real de `src/auth/callback.tsx`.

Esto garantiza que la ruta `/auth/callback` exista para Expo Router.

### 10.2 Registro de pantalla en stack

Archivo:
- `app/_layout.tsx`

Incluye:

- `Stack.Screen name="index"`
- `Stack.Screen name="auth/callback"`

### 10.3 Lógica de callback (`src/auth/callback.tsx`)

Esta función completa la autenticación al volver de Google.

Qué hace `AuthCallback()`:

1. Si NO es web:
   - Redirige a `/`.

2. Si es web:
   - Lee URL actual.
   - Busca errores en query params (`error`, `error_description`).
   - Si viene `?code=...`:
     - Ejecuta `exchangeCodeForSession(code)`.
   - Si NO viene `code`, intenta leer hash `#access_token=...&refresh_token=...`:
     - Ejecuta `setSession({ access_token, refresh_token })`.

3. Si completa sesión:
   - Limpia URL con `window.history.replaceState`.
   - Redirige a `/`.

4. Si falla:
   - Muestra mensaje en pantalla.

Por qué soporta dos formatos (`code` y `hash`):
- Dependiendo de configuración y flujo OAuth, Supabase puede regresar en uno u otro formato.

---

## 11. Hook de sesión (`src/auth/useSession.ts`)

Funciones exportadas:

- `useSession()`
  - Devuelve la sesión actual (`Session | null`).
  - Carga sesión inicial con `getSession()`.
  - Escucha cambios con `onAuthStateChange`.

- `signOut()`
  - Cierra sesión con `supabase.auth.signOut()`.

Este hook es útil para otras pantallas que quieras proteger.

---

## 12. Probar paso a paso

### 12.1 Probar correo/contraseña

1. Ejecuta:

```bash
npm run start
```

2. Abre app en web o dispositivo.
3. En pantalla principal:
   - Cambia entre `Iniciar sesión` y `Registrarse`.
   - Registra usuario nuevo.
   - Inicia sesión.
   - Cierra sesión.

### 12.2 Probar Google en Web

1. Ejecuta web:

```bash
npm run web
```

2. Confirma el puerto (por ejemplo `8081`).
3. Verifica que Supabase tenga exactamente:
   - `http://localhost:8081/auth/callback`
4. Presiona botón `Iniciar Sesion Con Google`.
5. Completa Google.
6. Debe volver a `/auth/callback`, procesar sesión y regresar a `/`.

### 12.3 Probar Google en Mobile

1. Verifica en Supabase:
   - `logingoogle://auth/callback`
2. Usa development build (no depender de Expo Go para casos OAuth complejos).
3. Presiona botón Google.
4. Debe abrir navegador, autenticar y volver a la app con sesión activa.

---

## 13. Problemas comunes y solución

### Error: `Unmatched Route` en `/auth/callback`

Causa:
- No existe `app/auth/callback.tsx` o no está registrada la ruta.

Solución:
- Verifica:
  - `app/auth/callback.tsx`
  - `app/_layout.tsx` con `Stack.Screen name="auth/callback"`

### Error: `redirect_to is not allowed` o `redirect_uri_mismatch`

Causa:
- URL de retorno no está en allow list de Supabase.

Solución:
- Agrega URL exacta (incluyendo puerto correcto).

### Regresa con token en hash y no inicia sesión

Causa:
- Callback solo leía `code`.

Solución:
- Usa callback actual que soporta `code` y `access_token/refresh_token`.

### No vuelve a la app en mobile

Causa típica:
- `scheme` incorrecto o no reconstruiste build después de cambiarlo.

Solución:
- Revisa `app.json` (`scheme: logingoogle`) y rebuild.

---

## 14. Qué función hace qué (resumen rápido)

- `getRedirectUri()`
  - Construye URL de callback correcta por plataforma.

- `signInWithGoogle()`
  - Inicia OAuth con Supabase y completa flujo web/mobile.

- `AuthCallback()`
  - Procesa datos devueltos por OAuth y guarda sesión.

- `useSession()`
  - Lee y mantiene estado de sesión en React.

- `signOut()`
  - Cierra sesión del usuario.

- `onAuthWithEmail()` (en `app/index.tsx`)
  - Login o registro por correo/contraseña.

- `onSignOut()` (en `app/index.tsx`)
  - Logout desde la pantalla principal.

---

## 15. Checklist final (rápido)

- `app.json` tiene `scheme: "logingoogle"`.
- `.env` tiene `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY`.
- Google provider activado en Supabase con credenciales correctas.
- Redirect URL en Supabase para web local con puerto real.
- Redirect URL en Supabase para mobile: `logingoogle://auth/callback`.
- Existe `app/auth/callback.tsx`.
- Existe `src/auth/callback.tsx` con manejo de `code` y `hash`.

Con esto, el proyecto queda listo para demostrar en clase:
- Auth por correo/contraseña.
- Auth con Google en web y mobile.

---

## 16. Código completo de funciones y archivos clave

Esta sección es para que tu documento en Notion sea autosuficiente.

### 16.1 `src/utils/supabase.ts`

```ts
import 'react-native-url-polyfill/auto'
import { createClient, processLock } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  })
```

### 16.2 `src/auth/redirect.ts`

```ts
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

export function getRedirectUri() {
    return AuthSession.makeRedirectUri({
        scheme: Platform.OS === 'web' ? undefined : 'logingoogle',
        path: 'auth/callback'
    })
}
```

### 16.3 `src/auth/signInWithGoogle.ts`

```ts
import { supabase } from "../utils/supabase";
import { getRedirectUri } from "./redirect";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

export async function signInWithGoogle() {
  const redirectTo = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("No recibio url desde la data de supabase");

  // web
  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return;
  }

  // mobile
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    console.error("Autenticación con Google cancelada o incompleta", result);
    return;
  }

  const callbackUrl = new URL(result.url);
  const code = callbackUrl.searchParams.get("code");

  if (!code) {
    console.error(
      "No se recibió el código de autenticación en la URL de redirección",
    );
    return;
  }

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error(
      "Error al intercambiar el código por una sesión",
      exchangeError,
    );
  }
}
```

### 16.4 `src/auth/callback.tsx`

```tsx
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
```

### 16.5 `app/auth/callback.tsx`

```tsx
export { default } from '@/src/auth/callback';
```

### 16.6 `src/auth/useSession.ts`

```ts
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}

export async function signOut() {
    const {error} = await supabase.auth.signOut()
    if(error) console.log('Error al cerrar sesión:', error.message)
}
```

### 16.7 `src/screens/LoginScreens.tsx`

```tsx
import { Text, StyleSheet, Pressable} from 'react-native'
import { signInWithGoogle } from '../auth/signInWithGoogle'

export function LoginScreen(){
    return(
        <Pressable
            accessibilityRole="button"
            onPress={signInWithGoogle}
            style={[styles.googleButton]}>
            
            <Text style={styles.googleButtonText}>
            Iniciar Sesion Con Google
            </Text>
            
        </Pressable>
    )
}

const styles = StyleSheet.create({
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
  }
})
```

### 16.8 `app/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/callback" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
```

### 16.9 Funciones de correo/contraseña dentro de `app/index.tsx`

```ts
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
```
