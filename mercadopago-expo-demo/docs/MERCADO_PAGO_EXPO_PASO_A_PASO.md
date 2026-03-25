# Mercado Pago + Expo

Guia paso a paso para crear una demo didactica de **Mercado Pago Checkout Pro** en **Expo**, pensada para personas con poca experiencia en Expo y en JavaScript.

Esta guia esta alineada con el proyecto que ya existe en este repositorio.

---

## 1. Que vas a construir

Vas a montar una app de Expo que hace este flujo:

1. La app le pide a un backend que cree una preferencia de pago.
2. El backend usa el **Access Token** de Mercado Pago para crear esa preferencia.
3. La app abre **Checkout Pro** dentro de iOS usando `expo-web-browser`.
4. Cuando el pago termina, Mercado Pago vuelve a la app con un **deep link**.
5. La app muestra el resultado recibido: `success`, `failure` o `pending`.

### Por que se eligio Checkout Pro

Para una demo de Expo enfocada en principiantes, **Checkout Pro** es la opcion mas simple y segura porque:

- Mercado Pago se encarga de la interfaz del checkout.
- Tu app no tiene que capturar ni procesar datos sensibles de tarjeta.
- La integracion mobile oficial con Expo se basa en abrir una URL y volver con deep link.
- El backend solo necesita crear la preferencia de pago.

En otras palabras: es la forma mas didactica de explicar el flujo completo sin meterse en una integracion mas avanzada de Checkout API.

---

## 2. Requisitos previos

Antes de empezar, necesitas:

- Node.js instalado.
- npm instalado.
- Xcode instalado si vas a ejecutar iOS Simulator en Mac.
- Una cuenta de Mercado Pago.
- Un proyecto de prueba nuevo en Mercado Pago Developers.

En este repo ya existe el proyecto listo, pero si quieres repetir el proceso desde cero, esta fue la base:

```bash
npx create-expo-app mercadopago-expo-demo --template blank
cd mercadopago-expo-demo
npx expo install expo-dev-client expo-web-browser expo-linking
npm install express mercadopago dotenv
```

---

## 3. Crear la aplicacion en Mercado Pago Developers

Mercado Pago trabaja con el concepto de **aplicacion**. Esa aplicacion es la que agrupa tus credenciales y tu integracion.

### Paso a paso

1. Entra a Mercado Pago Developers e inicia sesion con tu cuenta.
2. Haz clic en **Crear aplicacion**.
3. Ponle un nombre claro, por ejemplo: `Demo Expo Mercado Pago`.
4. Elige **Pagos online**.
5. Indica que tu tienda es de **desarrollo propio**.
6. Elige **Checkouts**.
7. Selecciona **Checkout Pro**.
8. Confirma y crea la aplicacion.

### Ruta resumida

La ruta oficial es esta:

`Pagos online -> desarrollo propio -> Checkouts -> Checkout Pro`

---

## 4. Donde encontrar las credenciales de prueba

Cuando creas la aplicacion, Mercado Pago tambien genera credenciales de prueba.

Las dos mas importantes son:

- **Public Key**
  Sirve para frontend.
- **Access Token**
  Sirve para backend.

### En esta demo, cual se usa realmente

En este proyecto:

- **NO usamos la Public Key** porque no estamos integrando un SDK de tarjeta en frontend.
- **SI usamos el Access Token** porque el backend crea la preferencia.

### Regla importante

El `Access Token` **nunca** debe ir dentro de la app Expo.

Debe vivir solo en el backend, dentro de variables de entorno.

---

## 5. Estructura del proyecto

La estructura relevante del repo es esta:

```txt
mercadopago-expo-demo/
  App.js
  app.json
  package.json
  .env.example
  server/
    index.js
  docs/
    MERCADO_PAGO_EXPO_PASO_A_PASO.md
```

### Que hace cada archivo

- `App.js`
  Pantalla unica del demo. Crea el flujo visual, llama al backend, abre Checkout Pro y procesa el deep link de regreso.
- `app.json`
  Configura Expo, el `scheme` y la identidad de la app.
- `server/index.js`
  Backend Express que crea la preferencia en Mercado Pago.
- `.env.example`
  Muestra las variables de entorno necesarias.
- `docs/MERCADO_PAGO_EXPO_PASO_A_PASO.md`
  Esta guia.

---

## 6. Variables de entorno

Primero crea tu archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

El contenido esperado es este:

```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxx
PORT=3001
```

### Que hace cada variable

#### `EXPO_PUBLIC_API_BASE_URL`

- La usa la app Expo.
- Debe apuntar a tu backend local.
- En **iOS Simulator**, `127.0.0.1` funciona bien porque el simulador comparte el host de tu Mac.

#### `MERCADO_PAGO_ACCESS_TOKEN`

- Lo usa el backend.
- Debe ser tu **Access Token de pruebas**.
- Nunca debe ponerse en el frontend.

#### `PORT`

- Es el puerto donde levanta el servidor Express.
- En esta demo usamos `3001`.

### Nota para iPhone fisico

Esta guia esta pensada para **iOS Simulator**.

Si luego quieres correrlo en un iPhone real:

- `127.0.0.1` ya no te sirve.
- Debes reemplazar `EXPO_PUBLIC_API_BASE_URL` por la IP local de tu Mac.

Ejemplo:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:3001
```

---

## 7. Configurar Expo para deep links

Mercado Pago necesita una forma de volver a tu app cuando termina el pago.

Para eso usamos un **scheme** fijo:

```json
"scheme": "mercadopagoexpo"
```

La app genera y espera URLs de retorno como estas:

```txt
mercadopagoexpo://checkout/success
mercadopagoexpo://checkout/failure
mercadopagoexpo://checkout/pending
```

### Por que esta demo usa development build y no Expo Go como flujo principal

Expo documenta que, cuando necesitas un deep link estable para callbacks, **conviene usar build o development build** y un `scheme` propio.

Por eso este proyecto ya esta preparado para trabajar con:

- `expo-dev-client`
- `expo-web-browser`
- `expo-linking`

---

## 8. Backend: crear la preferencia de pago

El backend esta en:

- `server/index.js`

Su trabajo es:

1. Leer `MERCADO_PAGO_ACCESS_TOKEN`.
2. Crear un cliente oficial de Mercado Pago.
3. Exponer `POST /api/create-preference`.
4. Validar el payload.
5. Crear la preferencia con `items`, `back_urls`, `auto_return` y `external_reference`.
6. Devolver `preferenceId` e `initPoint`.

### Payload que recibe

```json
POST /api/create-preference
{
  "title": "Producto demo",
  "quantity": 1,
  "unitPrice": 200,
  "backUrls": {
    "success": "mercadopagoexpo://checkout/success",
    "failure": "mercadopagoexpo://checkout/failure",
    "pending": "mercadopagoexpo://checkout/pending"
  }
}
```

### Respuesta que devuelve

```json
{
  "preferenceId": "123...",
  "initPoint": "https://www.mercadopago.com/checkout/..."
}
```

### Que atributos de Mercado Pago se usan

En el backend se envian estos datos a Mercado Pago:

- `items`
- `back_urls`
- `auto_return: "approved"`
- `external_reference`

### Que significa cada uno

- `items`
  Es lo que estas cobrando.
- `back_urls`
  Le dice a Mercado Pago a que URL debe regresar.
- `auto_return`
  Hace que, cuando el pago este aprobado, Mercado Pago intente volver automaticamente.
- `external_reference`
  Te sirve para identificar la operacion en tu sistema.

### Que hace cada parte de `server/index.js`

#### Carga de variables de entorno

```js
dotenv.config();
```

Carga el archivo `.env`.

#### Validacion del Access Token

Si falta `MERCADO_PAGO_ACCESS_TOKEN`, el servidor:

- muestra un mensaje claro en consola;
- termina el proceso;
- evita que la app arranque en un estado roto.

#### Cliente oficial

```js
const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN,
});
```

Ese cliente es el que habla con la API oficial.

#### Preference client

```js
const preferenceClient = new Preference(mercadoPagoClient);
```

Este objeto se especializa en crear preferencias.

#### Endpoint Express

```js
app.post('/api/create-preference', async (req, res) => {
  ...
});
```

Ese endpoint:

- recibe el producto;
- valida que los datos tengan sentido;
- crea la preferencia;
- devuelve la URL del checkout.

---

## 9. Frontend: abrir Checkout Pro y escuchar el deep link

El frontend vive en:

- `App.js`

Es una pantalla unica para que el flujo sea facil de explicar.

### Que hace cada parte de `App.js`

#### Constantes del demo

Se definen:

- el `scheme`;
- la URL del backend;
- el producto a cobrar;
- las `back_urls`.

Ejemplo:

```js
const RETURN_URLS = {
  success: 'mercadopagoexpo://checkout/success',
  failure: 'mercadopagoexpo://checkout/failure',
  pending: 'mercadopagoexpo://checkout/pending',
};
```

#### `handlePayPress`

Es la funcion mas importante del frontend.

Hace esto:

1. Llama al backend.
2. Recibe `preferenceId` e `initPoint`.
3. Guarda esos datos en pantalla.
4. Abre Mercado Pago con `WebBrowser.openBrowserAsync(initPoint)`.

#### `ExpoLinking.useURL()`

Este hook escucha la URL que abre tu app.

Cuando Mercado Pago manda al usuario de regreso, la app recibe algo parecido a esto:

```txt
mercadopagoexpo://checkout/success?payment_id=...&status=approved&merchant_order_id=...&preference_id=...&external_reference=...
```

#### `parseCheckoutReturn`

Esta funcion toma la URL de regreso y extrae:

- `route`
- `status`
- `paymentId`
- `merchantOrderId`
- `preferenceId`
- `externalReference`

#### `WebBrowser.dismissBrowser()`

En iOS, la documentacion oficial explica que **Safari View Controller debe cerrarse manualmente** al volver por deep link.

Por eso, cuando la app detecta una URL de regreso valida, ejecuta:

```js
WebBrowser.dismissBrowser();
```

#### Bloque de logs

La pantalla guarda mensajes como:

- cuando se pide la preferencia;
- cuando se crea;
- cuando se abre el navegador;
- cuando vuelve el deep link.

Eso ayuda mucho cuando estas ensenando el flujo en vivo.

---

## 10. Ejecutar la demo en iOS Simulator

### Paso 1. Instalar dependencias

```bash
npm install
```

### Paso 2. Arrancar el backend

En una terminal:

```bash
npm run server
```

Debes ver algo asi:

```txt
Servidor listo en http://127.0.0.1:3001
Endpoint disponible: POST /api/create-preference
```

### Paso 3. Generar e instalar el development build

La primera vez, corre:

```bash
npm run ios
```

Como el script usa `expo run:ios`, Expo va a:

- generar el proyecto nativo si hace falta;
- compilar la app;
- instalarla en iOS Simulator.

### Paso 4. Levantar Metro en modo dev client

En otra terminal:

```bash
npm start
```

Ese script usa:

```bash
expo start --dev-client
```

Asi te aseguras de abrir el proyecto con el development build y no con Expo Go.

### Flujo practico recomendado

Usa este orden:

1. `npm run server`
2. `npm start`
3. `npm run ios`

La primera vez puede tardar mas porque se construye la app nativa.

---

## 11. Probar el retorno sin pagar de verdad

Antes de hacer una compra real de prueba, puedes comprobar que el deep link funciona con este comando:

```bash
npx uri-scheme open "mercadopagoexpo://checkout/success?status=approved&payment_id=123456&merchant_order_id=654321&preference_id=demo-preference&external_reference=demo-expo-1" --ios
```

Si todo esta bien:

- la app se abre;
- se actualiza el bloque "Ultimo retorno recibido";
- veras el estado `Aprobado`.

Tambien puedes probar `pending` o `failure`:

```bash
npx uri-scheme open "mercadopagoexpo://checkout/pending?status=pending&payment_id=222&merchant_order_id=333&preference_id=demo-preference&external_reference=demo-expo-2" --ios
```

```bash
npx uri-scheme open "mercadopagoexpo://checkout/failure?status=rejected&payment_id=444&merchant_order_id=555&preference_id=demo-preference&external_reference=demo-expo-3" --ios
```

Esto es muy util para ensenar primero el concepto del retorno antes de hacer el pago completo.

---

## 12. Hacer una compra de prueba con Mercado Pago

### Paso 1. Crear o ubicar una cuenta de comprador de prueba

Sigue la documentacion oficial de pruebas de integracion para tener una cuenta de comprador de prueba.

La idea es:

- tu aplicacion usa credenciales de prueba;
- el checkout se prueba con un comprador de prueba;
- no usas una tarjeta real.

### Paso 2. Recomendacion oficial: usar modo incognito

Mercado Pago recomienda hacer las compras de prueba en una **pestana de incognito** para evitar mezclar sesiones.

Como esta demo es mobile, aplica esta traduccion practica:

- si depuras el `initPoint` directo en Safari del simulador, hazlo en una ventana privada;
- si pruebas desde la app, procura no tener otra sesion de Mercado Pago abierta en el simulador.

### Paso 3. Abrir el checkout desde la app

En la app:

1. toca **Pagar con Mercado Pago**;
2. espera a que se cree la preferencia;
3. el checkout se abre en Safari View Controller.

### Paso 4. Iniciar sesion con el comprador de prueba

Dentro del checkout:

- inicia sesion con la cuenta de comprador de prueba;
- completa el flujo con una tarjeta de prueba.

### Tarjetas de prueba para Mexico

Segun la documentacion oficial de pruebas para Mexico:

| Tipo | Marca | Numero | CVV | Vencimiento |
| --- | --- | --- | --- | --- |
| Credito | Mastercard | `5474 9254 3267 0366` | `123` | `11/30` |
| Credito | Visa | `4075 5957 1648 3764` | `123` | `11/30` |
| Credito | American Express | `3711 803032 57522` | `1234` | `11/30` |
| Debito | Mastercard | `5579 0534 6148 2647` | `123` | `11/30` |
| Debito | Visa | `4189 1412 2126 7633` | `123` | `11/30` |

### Como simular distintos resultados en Mexico

Para Mexico, la tabla oficial usa el **nombre del titular** para simular el resultado.

| Nombre del titular | Resultado esperado |
| --- | --- |
| `APRO` | Pago aprobado |
| `OTHE` | Rechazado por error general |
| `CONT` | Pendiente de pago |
| `CALL` | Rechazado con validacion para autorizar |
| `FUND` | Rechazado por importe insuficiente |
| `SECU` | Rechazado por codigo de seguridad invalido |
| `EXPI` | Rechazado por problema de vencimiento |
| `FORM` | Rechazado por error de formulario |
| `CARD` | Rechazado por falta de numero de tarjeta |
| `INST` | Rechazado por cuotas invalidas |
| `DUPL` | Rechazado por pago duplicado |
| `LOCK` | Rechazado por tarjeta deshabilitada |
| `CTNA` | Rechazado por tipo de tarjeta no permitida |
| `ATTE` | Rechazado por demasiados intentos de PIN |
| `BLAC` | Rechazado por lista negra |
| `UNSU` | No soportado |
| `TEST` | Usado para reglas de monto |

### Que deberias ver en la app

Cuando Mercado Pago regrese a tu app:

- en `success`, la tarjeta verde se marca como activa;
- en `pending`, la tarjeta amarilla se marca como activa;
- en `failure`, la tarjeta roja se marca como activa.

Ademas, la app muestra:

- `payment_id`
- `merchant_order_id`
- `preference_id`
- `external_reference`

---

## 13. Contrato del deep link de retorno

El contrato que usa esta demo es:

```txt
mercadopagoexpo://checkout/{success|failure|pending}?payment_id=...&status=...&merchant_order_id=...&preference_id=...&external_reference=...
```

### Que significa cada parte

- `mercadopagoexpo`
  Es el scheme de la app.
- `checkout`
  Es el host que usamos para identificar que la URL pertenece al flujo de pago.
- `success`, `failure`, `pending`
  Es la ruta que indica el tipo de retorno.
- query params
  Son los datos que Mercado Pago agrega cuando vuelve a tu app.

---

## 14. Checklist para salir a produccion

Cuando el flujo de pruebas ya funcione, antes de cobrar de verdad debes hacer esto:

1. Activar credenciales de produccion en Mercado Pago Developers.
2. Reemplazar el `TEST_ACCESS_TOKEN` por el token productivo.
3. Usar URLs reales y seguras en tu backend.
4. Tener **SSL/HTTPS** en el entorno de produccion.
5. Revisar si quieres agregar notificaciones de pago para sincronizar estados.

### Importante

Esta demo **no implementa webhooks** ni verificacion posterior del pago.

Eso esta bien para una demo base, pero en produccion normalmente querras:

- notificaciones de pago;
- persistencia de pedidos;
- validacion del estado del pago en backend.

---

## 15. Comandos utiles del proyecto

### Instalar dependencias

```bash
npm install
```

### Arrancar backend

```bash
npm run server
```

### Arrancar Metro para dev client

```bash
npm start
```

### Compilar e instalar iOS Simulator

```bash
npm run ios
```

### Prebuild iOS manual

```bash
npm run prebuild:ios
```

### Prebuild iOS limpio

```bash
npm run prebuild:clean:ios
```

---

## 16. Resumen rapido de lo mas importante 

estos son los mensajes clave:

1. **La app cliente no crea pagos directamente.**
   El backend crea la preferencia.
2. **El Access Token nunca va en Expo.**
   Va solo en el backend.
3. **Checkout Pro ya trae la UI del pago.**
   Tu app solo lo abre.
4. **El retorno a la app se hace con deep links.**
   Por eso configuramos `scheme`.
5. **En iOS hay que cerrar Safari View Controller manualmente.**
   Eso lo hace `WebBrowser.dismissBrowser()`.

