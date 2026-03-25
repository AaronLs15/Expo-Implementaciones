import { StatusBar } from 'expo-status-bar';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const APP_SCHEME = 'mercadopagoexpo';
const CHECKOUT_HOST = 'checkout';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001';

const PRODUCT_TO_PAY = {
  title: 'Producto demo Expo + Mercado Pago',
  quantity: 1,
  unitPrice: 200,
};

const RETURN_URLS = {
  success: `${APP_SCHEME}://${CHECKOUT_HOST}/success`,
  failure: `${APP_SCHEME}://${CHECKOUT_HOST}/failure`,
  pending: `${APP_SCHEME}://${CHECKOUT_HOST}/pending`,
};

const STATUS_META = {
  success: {
    label: 'Aprobado',
    description: 'Mercado Pago regreso a la app con un pago aprobado.',
    accent: '#0F9D58',
    background: '#EAF8EF',
  },
  failure: {
    label: 'Rechazado',
    description: 'Mercado Pago regreso a la app con un pago rechazado o fallido.',
    accent: '#D93025',
    background: '#FDEEEE',
  },
  pending: {
    label: 'Pendiente',
    description: 'Mercado Pago regreso a la app con un pago pendiente.',
    accent: '#C88700',
    background: '#FFF4DB',
  },
};

function getLogLine(message) {
  const time = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return `[${time}] ${message}`;
}

function pushLog(currentLogs, message) {
  return [getLogLine(message), ...currentLogs].slice(0, 10);
}

function normalizeQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function parseCheckoutReturn(url) {
  if (!url || !url.startsWith(`${APP_SCHEME}://`)) {
    return null;
  }

  const parsed = ExpoLinking.parse(url);
  const joinedPath = [parsed.hostname, parsed.path].filter(Boolean).join('/');

  if (!joinedPath.startsWith(`${CHECKOUT_HOST}/`)) {
    return null;
  }

  const route = joinedPath.replace(`${CHECKOUT_HOST}/`, '') || 'pending';
  const queryParams = parsed.queryParams || {};

  return {
    route,
    status: normalizeQueryValue(queryParams.status) || route,
    paymentId: normalizeQueryValue(queryParams.payment_id),
    merchantOrderId: normalizeQueryValue(queryParams.merchant_order_id),
    preferenceId: normalizeQueryValue(queryParams.preference_id),
    externalReference: normalizeQueryValue(queryParams.external_reference),
    rawUrl: url,
  };
}

function StatusCard({ type, activeType }) {
  const meta = STATUS_META[type];
  const isActive = type === activeType;

  return (
    <View
      style={[
        styles.statusCard,
        { backgroundColor: meta.background, borderColor: meta.accent },
        isActive && styles.statusCardActive,
      ]}>
      <Text style={[styles.statusBadge, { color: meta.accent }]}>{meta.label}</Text>
      <Text style={styles.statusDescription}>{meta.description}</Text>
    </View>
  );
}

function StepCard({ index, title, description }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{index}</Text>
      </View>
      <View style={styles.stepTextBlock}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'Sin dato'}</Text>
    </View>
  );
}

export default function App() {
  const incomingUrl = ExpoLinking.useURL();
  const [logs, setLogs] = useState([
    getLogLine('La app esta lista para crear una preferencia y abrir Checkout Pro.'),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  useEffect(() => {
    if (!incomingUrl) {
      return;
    }

    const parsedResult = parseCheckoutReturn(incomingUrl);

    if (!parsedResult) {
      setLogs((currentLogs) =>
        pushLog(currentLogs, `Se recibio una URL que no corresponde al demo: ${incomingUrl}`)
      );
      return;
    }

    if (Platform.OS === 'ios') {
      WebBrowser.dismissBrowser().catch(() => {
        setLogs((currentLogs) =>
          pushLog(currentLogs, 'No fue necesario cerrar manualmente Safari View Controller.')
        );
      });
    }

    setPaymentResult(parsedResult);
    setLogs((currentLogs) =>
      pushLog(
        currentLogs,
        `Deep link recibido. Ruta: ${parsedResult.route}. Status: ${parsedResult.status}.`
      )
    );
  }, [incomingUrl]);

  async function handlePayPress() {
    setIsLoading(true);
    setPaymentResult(null);
    setLogs((currentLogs) =>
      pushLog(
        currentLogs,
        `Solicitando preferencia al backend en ${API_BASE_URL}/api/create-preference`
      )
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...PRODUCT_TO_PAY,
          backUrls: RETURN_URLS,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo crear la preferencia.');
      }

      if (!data.initPoint) {
        throw new Error('El backend respondio sin una URL de checkout.');
      }

      setCheckoutInfo(data);
      setLogs((currentLogs) =>
        pushLog(currentLogs, `Preferencia creada. ID: ${data.preferenceId || 'sin ID visible'}.`)
      );

      const browserResult = await WebBrowser.openBrowserAsync(data.initPoint);

      setLogs((currentLogs) =>
        pushLog(currentLogs, `El navegador regreso con el resultado local: ${browserResult.type}.`)
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Ocurrio un error inesperado al abrir Checkout Pro.';

      setLogs((currentLogs) => pushLog(currentLogs, `Error: ${message}`));
      Alert.alert('No se pudo iniciar el checkout', message);
    } finally {
      setIsLoading(false);
    }
  }

  const activeStatus = paymentResult?.route;
  const resultMeta = activeStatus ? STATUS_META[activeStatus] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Expo + Mercado Pago</Text>
          <Text style={styles.heroTitle}>Demo didactica de Checkout Pro para iOS</Text>
          <Text style={styles.heroSubtitle}>
            Esta app crea una preferencia en tu backend, abre el checkout de Mercado Pago y espera
            el regreso por deep link a la ruta <Text style={styles.inlineCode}>{APP_SCHEME}://</Text>.
          </Text>

          <View style={styles.heroMetaGrid}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaLabel}>API base URL</Text>
              <Text style={styles.heroMetaValue}>{API_BASE_URL}</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaLabel}>Scheme</Text>
              <Text style={styles.heroMetaValue}>{APP_SCHEME}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.payButton,
              pressed && styles.payButtonPressed,
              isLoading && styles.payButtonDisabled,
            ]}
            disabled={isLoading}
            onPress={handlePayPress}>
            {isLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.payButtonText}>Creando preferencia...</Text>
              </View>
            ) : (
              <Text style={styles.payButtonText}>Pagar con Mercado Pago</Text>
            )}
          </Pressable>

          <Text style={styles.buttonHint}>
            Producto demo: {PRODUCT_TO_PAY.title} | Cantidad: {PRODUCT_TO_PAY.quantity} | Precio:
            ${PRODUCT_TO_PAY.unitPrice} MXN
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Que pasa cuando tocas el boton</Text>
          <StepCard
            index="1"
            title="La app llama a tu backend"
            description="Envia titulo, cantidad, precio y las back_urls para que el backend cree una preferencia segura."
          />
          <StepCard
            index="2"
            title="El backend usa tu Access Token"
            description="Solo el servidor conoce MERCADO_PAGO_ACCESS_TOKEN y lo usa para hablar con la API oficial."
          />
          <StepCard
            index="3"
            title="Checkout Pro se abre en Safari View Controller"
            description="En iOS el checkout se muestra dentro de la app con expo-web-browser."
          />
          <StepCard
            index="4"
            title="Mercado Pago vuelve a la app"
            description="Cuando el pago termina, Mercado Pago abre una URL como mercadopagoexpo://checkout/success."
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Estados que muestra el demo</Text>
          <StatusCard type="success" activeType={activeStatus} />
          <StatusCard type="pending" activeType={activeStatus} />
          <StatusCard type="failure" activeType={activeStatus} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ultima preferencia creada</Text>
          <DetailRow label="Preference ID" value={checkoutInfo?.preferenceId} />
          <DetailRow label="Init Point" value={checkoutInfo?.initPoint} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ultimo retorno recibido</Text>

          {paymentResult && resultMeta ? (
            <View style={[styles.resultBanner, { backgroundColor: resultMeta.background }]}>
              <Text style={[styles.resultBannerTitle, { color: resultMeta.accent }]}>
                {resultMeta.label}
              </Text>
              <Text style={styles.resultBannerSubtitle}>{resultMeta.description}</Text>
            </View>
          ) : (
            <View style={styles.resultBannerPlaceholder}>
              <Text style={styles.resultBannerPlaceholderText}>
                Aun no se ha recibido un deep link de regreso desde Mercado Pago.
              </Text>
            </View>
          )}

          <DetailRow label="Ruta" value={paymentResult?.route} />
          <DetailRow label="Status" value={paymentResult?.status} />
          <DetailRow label="Payment ID" value={paymentResult?.paymentId} />
          <DetailRow label="Merchant Order ID" value={paymentResult?.merchantOrderId} />
          <DetailRow label="Preference ID" value={paymentResult?.preferenceId} />
          <DetailRow label="External Reference" value={paymentResult?.externalReference} />
          <DetailRow label="URL completa" value={paymentResult?.rawUrl} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Back URLs que la app envia</Text>
          <DetailRow label="success" value={RETURN_URLS.success} />
          <DetailRow label="failure" value={RETURN_URLS.failure} />
          <DetailRow label="pending" value={RETURN_URLS.pending} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Log de aprendizaje</Text>
          <View style={styles.logBox}>
            {logs.map((line, index) => (
              <Text key={`${index}-${line}`} style={styles.logLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7D9',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  heroCard: {
    backgroundColor: '#FFE600',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#00356B',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#263238',
    marginBottom: 18,
  },
  inlineCode: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontWeight: '700',
  },
  heroMetaGrid: {
    gap: 10,
    marginBottom: 18,
  },
  heroMetaCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 18,
    padding: 14,
  },
  heroMetaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00356B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  heroMetaValue: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0A2540',
    fontWeight: '600',
  },
  payButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009EE3',
  },
  payButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  payButtonDisabled: {
    opacity: 0.75,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#3C4858',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0E7C8',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: '#0A2540',
  },
  stepCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  stepTextBlock: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: '#102A43',
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#486581',
  },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statusCardActive: {
    borderWidth: 2,
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334E68',
  },
  resultBanner: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  resultBannerPlaceholder: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#F7F9FC',
  },
  resultBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultBannerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334E68',
  },
  resultBannerPlaceholderText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#627D98',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#627D98',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 20,
    color: '#102A43',
  },
  logBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#0F172A',
    gap: 8,
  },
  logLine: {
    color: '#D6E4FF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});
