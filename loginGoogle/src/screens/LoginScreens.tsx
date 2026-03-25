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