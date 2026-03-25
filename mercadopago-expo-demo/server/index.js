const express = require('express');
const dotenv = require('dotenv');
const { MercadoPagoConfig, Preference } = require('mercadopago');

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('');
  console.error('Falta la variable MERCADO_PAGO_ACCESS_TOKEN.');
  console.error('Crea un archivo .env en la raiz del proyecto y agrega tu token de pruebas.');
  console.error('Ejemplo: MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxx');
  console.error('');
  process.exit(1);
}

const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN,
  options: {
    timeout: 5000,
  },
});

const preferenceClient = new Preference(mercadoPagoClient);
const app = express();

app.use(express.json());

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasValidBackUrls(backUrls) {
  if (!backUrls || typeof backUrls !== 'object') {
    return false;
  }

  return ['success', 'failure', 'pending'].every((key) => typeof backUrls[key] === 'string');
}

function pickCheckoutUrl(preferenceResponse) {
  const isTestToken = ACCESS_TOKEN.startsWith('TEST-');

  if (isTestToken) {
    return preferenceResponse.sandbox_init_point || preferenceResponse.init_point || null;
  }

  return preferenceResponse.init_point || preferenceResponse.sandbox_init_point || null;
}

app.post('/api/create-preference', async (req, res) => {
  const { title, quantity, unitPrice, backUrls } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({
      message: 'El campo "title" es obligatorio y debe ser texto.',
    });
  }

  if (!isPositiveNumber(quantity)) {
    return res.status(400).json({
      message: 'El campo "quantity" debe ser un numero mayor que cero.',
    });
  }

  if (!isPositiveNumber(unitPrice)) {
    return res.status(400).json({
      message: 'El campo "unitPrice" debe ser un numero mayor que cero.',
    });
  }

  if (!hasValidBackUrls(backUrls)) {
    return res.status(400).json({
      message:
        'El campo "backUrls" debe incluir success, failure y pending con URLs validas.',
    });
  }

  const externalReference = `demo-expo-${Date.now()}`;

  try {
    const preferenceResponse = await preferenceClient.create({
      body: {
        items: [
          {
            title: title.trim(),
            quantity,
            unit_price: unitPrice,
            currency_id: 'MXN',
          },
        ],
        back_urls: {
          success: backUrls.success,
          failure: backUrls.failure,
          pending: backUrls.pending,
        },
        auto_return: 'approved',
        external_reference: externalReference,
      },
    });

    const initPoint = pickCheckoutUrl(preferenceResponse);

    if (!initPoint) {
      return res.status(502).json({
        message: 'Mercado Pago respondio sin init_point ni sandbox_init_point.',
      });
    }

    return res.json({
      preferenceId: preferenceResponse.id || null,
      initPoint,
    });
  } catch (error) {
    const cause = Array.isArray(error?.cause) ? error.cause : [];
    const firstCause = cause[0] || {};
    const mercadoPagoMessage =
      firstCause.description || firstCause.message || error.message || 'Error desconocido.';

    console.error('Error al crear la preferencia:', error);

    return res.status(500).json({
      message: `No se pudo crear la preferencia en Mercado Pago. ${mercadoPagoMessage}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor listo en http://127.0.0.1:${PORT}`);
  console.log('Endpoint disponible: POST /api/create-preference');
});
