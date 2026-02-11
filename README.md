## KoaBot - Restaurant Management Bot

Monorepo para un bot de Telegram que registra **Recepción** (albaranes), **Merma** y **Producción** en **Google Sheets** y genera **reportes semanales en PDF**. Futuro: dashboard en Angular.

### Estructura

- `apps/api`: API NestJS con Google Sheets como almacenamiento
- `apps/bot`: Bot de Telegram con Telegraf
- `packages/shared`: Tipos, validaciones y utilidades compartidas

### Requisitos previos

- Node.js 20+
- pnpm 9+
- Cuenta de servicio de Google (Service Account) con acceso a Google Sheets API
- Token de bot de Telegram (crear bot con [@BotFather](https://t.me/BotFather))

### Instalación

1. **Instalar dependencias**

   ```bash
   pnpm install
   ```

2. **Crear Spreadsheet en Google Sheets**

   - Crea una hoja de cálculo vacía en Google Sheets
   - Copia el `spreadsheetId` de la URL (ejemplo: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`)
   - Comparte el documento con el email de la Service Account (permiso de **Editor**)

3. **Configurar Service Account de Google**

   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Crea un proyecto o selecciona uno existente
   - Habilita la API de Google Sheets
   - Crea una Service Account y descarga el JSON de credenciales
   - Comparte tu Spreadsheet con el email de la Service Account (ej: `service-account@project.iam.gserviceaccount.com`)

4. **Configurar variables de entorno**

   Crea un archivo `.env` en la raíz del proyecto (o en `apps/api` y `apps/bot`):

   ```env
   # Google Sheets
   GOOGLE_SHEETS_SPREADSHEET_ID=tu-spreadsheet-id-aqui
   
   # Opción 1: Ruta al archivo JSON de Service Account
   GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./path/to/service-account.json
   
   # Opción 2: JSON inline (comentar la línea anterior y usar esta)
   # GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
   
   # API Server
   PORT=3000
   
   # Telegram Bot
   TELEGRAM_BOT_TOKEN=tu-token-del-bot-aqui
   API_BASE_URL=http://localhost:3000
   ```

5. **Bootstrap de Google Sheets**

   Ejecuta este comando para crear automáticamente las hojas y cabeceras necesarias:

   ```bash
   pnpm api:bootstrap-sheets
   ```

   Esto creará las siguientes hojas:
   - `users` - Usuarios del bot
   - `receptions` - Recepciones (albaranes)
   - `reception_items` - Items de recepciones
   - `wastages` - Mermas
   - `productions` - Producciones
   - `production_outputs` - Productos producidos

### Desarrollo

**Arrancar en modo desarrollo** (API + Bot en paralelo):

```bash
pnpm dev
```

Esto iniciará:
- API NestJS en `http://localhost:3000` (puerto configurable con `PORT`)
- Bot de Telegram conectado a la API

**Otros comandos útiles:**

```bash
# Build de todas las apps
pnpm build

# Lint de todo el monorepo
pnpm lint

# Formatear código
pnpm format

# Bootstrap de sheets (si necesitas recrear las hojas)
pnpm api:bootstrap-sheets
```

### Comandos del Bot

Una vez iniciado, prueba estos comandos en Telegram:

- `/start` - Inicia el bot y muestra ayuda
- `/recepcion` - Registra una recepción (albarán) con proveedor, fecha e items
- `/merma` - Registra merma con items y motivo opcional
- `/produccion` - Registra producción con lote, fecha y productos
- `/reporte` - Genera reporte semanal en PDF (semana actual o rango personalizado)

**Formato de items:**
```
REF; nombre del producto; cantidad; unidad
```

Ejemplo:
```
ABC123; Tomate; 10; kg
DEF456; Lechuga; 5; ud
GHI789; Aceite; 2; L
```

Unidades válidas: `ud`, `kg`, `L` (case-insensitive)

### API Endpoints

La API NestJS expone los siguientes endpoints:

- `GET /health` - Health check
- `POST /users/upsertByTelegramId` - Crear/actualizar usuario
- `POST /receptions` - Crear recepción
- `GET /receptions?from=YYYY-MM-DD&to=YYYY-MM-DD` - Listar recepciones
- `POST /wastages` - Crear merma individual
- `POST /wastages/batch` - Crear merma en lote
- `GET /wastages?from=YYYY-MM-DD&to=YYYY-MM-DD` - Listar mermas
- `POST /productions` - Crear producción
- `GET /productions?from=YYYY-MM-DD&to=YYYY-MM-DD` - Listar producciones
- `POST /reports/weekly?from=YYYY-MM-DD&to=YYYY-MM-DD` - Generar reporte PDF

### Docker (Opcional / Futuro)

Se incluye un `docker-compose.yml` comentado para futuras integraciones (p.ej. PostgreSQL). Actualmente no se requiere base de datos relacional ya que se usa Google Sheets como almacenamiento.

### Estructura de Datos

Los datos se almacenan en Google Sheets con las siguientes columnas:

**users:**
- user_id, telegram_id, name, created_at

**receptions:**
- reception_id, occurred_at, supplier, total, attachment_url, registered_by_user_id, created_at

**reception_items:**
- item_id, reception_id, ref, product, quantity, unit

**wastages:**
- wastage_id, occurred_at, ref, product, quantity, unit, reason, attachment_url, registered_by_user_id, created_at

**productions:**
- production_id, occurred_at, batch_name, produced_by_user_id, created_at

**production_outputs:**
- output_id, production_id, ref, product, quantity, unit

### Tecnologías

- **Monorepo**: pnpm workspaces
- **API**: NestJS + TypeScript
- **Bot**: Telegraf + TypeScript
- **Almacenamiento**: Google Sheets API v4
- **PDF**: Playwright (HTML to PDF)
- **Validación**: class-validator + class-transformer
- **Linting**: ESLint + Prettier


