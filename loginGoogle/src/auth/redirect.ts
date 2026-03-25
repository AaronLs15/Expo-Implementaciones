import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

export function getRedirectUri() {
    return AuthSession.makeRedirectUri({
        scheme: Platform.OS === 'web' ? undefined : 'logingoogle',
        path: 'auth/callback'
    })
}