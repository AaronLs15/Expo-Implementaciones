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

  //web
  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return;
  }

  //mobile
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
