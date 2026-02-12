## KoaBot - Restaurant Management Bot

Monorepo para un bot de Telegram que registra **Recepción** (albaranes), **Merma** y **Producción** en **Google Sheets** y genera **reportes en PDF**. 

El bot está diseñado para ser rápido y fácil de usar en un entorno de restaurante, con botones interactivos, autocompletado inteligente y parsing flexible de datos.

**Futuro**: Dashboard en Angular.

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

# Tests del bot (parser)
cd apps/bot && pnpm test
```

### Comandos del Bot

Una vez iniciado, prueba estos comandos en Telegram:

- `/start` - Inicia el bot y muestra ayuda
- `/recepcion` - Registra una recepción (albarán) con proveedor, fecha e items
- `/merma` - Registra merma con items y motivo opcional
- `/produccion` - Registra producción con lote, fecha y productos
- `/reporte` - Genera reporte en PDF (semana actual o rango personalizado)
- `/undo` - Deshace la última operación registrada desde este chat
- `/cancelar` - Cancela la acción en curso (también puedes escribir "cancelar" o "cancel")

### Interacción con el Bot

El bot utiliza **botones inline** (teclados interactivos) para facilitar la entrada de datos:

#### 📦 Recepción (`/recepcion`)

1. **Selección de proveedor**: El bot muestra los 5 proveedores más recientes como botones. También puedes escribir uno nuevo.
2. **Selección de fecha**: Botones rápidos para **Hoy**, **Ayer** o **Otra fecha** (formato YYYY-MM-DD).
3. **Items**: Envía los items, uno por línea (múltiples formatos aceptados, ver abajo).
4. **Confirmación**: Botones para **✅ Guardar**, **✏️ Editar** o **❌ Cancelar**.
   - Al editar puedes modificar: proveedor, fecha o items.
   - Tras guardar, aparece un botón **↩️ Deshacer último** para deshacer rápidamente.

#### 🗑️ Merma (`/merma`)

1. **Items**: Envía los items de merma, uno por línea.
   - Puedes incluir el motivo por línea o usar un motivo global.
2. **Confirmación**: Similar a recepción, con opciones de edición.

#### 🏭 Producción (`/produccion`)

1. **Selección de lote**: El bot muestra los 5 lotes más recientes como botones.
2. **Selección de fecha**: Botones rápidos (Hoy/Ayer/Otra fecha).
3. **Outputs**: Envía los productos producidos, uno por línea.
4. **Confirmación**: Botones de guardar/editar/cancelar.

#### 📊 Reporte (`/reporte`)

El comando `/reporte` acepta múltiples formatos:

**Botones rápidos** (aparecen al iniciar el comando):
- **📊 Semana** - Semana actual (lunes a domingo)
- **📊 Últimos 7 días** - Últimos 7 días hasta hoy
- **📊 Mes actual** - Desde el primer día del mes hasta hoy

**Formatos de texto aceptados**:
- `semana` o `semana actual` - Semana actual (lunes a domingo)
- `1` - Desde el día 1 del mes actual hasta hoy
- `1 a 11` - Del día 1 al 11 del mes actual
- `1-2 a 11-2` - Del 1 de febrero al 11 de febrero (año actual)
- `2024-01-01` - Desde esa fecha hasta hoy
- `2024-01-01 a 2024-01-07` - Rango específico
- `2024-01-01 a hoy` - Desde fecha hasta hoy

**Ejemplos**:
```
/reporte semana
/reporte 1
/reporte 1 a 11
/reporte 1-2 a 11-2
/reporte 2024-01-01
/reporte 2024-01-01 a 2024-01-07
/reporte 2024-01-01 a hoy
```

### Formatos de Items Aceptados

El bot acepta **múltiples formatos** para facilitar la entrada de datos:

#### Formato clásico (separado por `;`):
```
REF; nombre del producto; cantidad; unidad
REF; nombre del producto; cantidad; unidad; motivo  (para merma)
```

**Ejemplos**:
```
ABC123; Tomate; 10; kg
DEF456; Lechuga; 5; ud
POLLO001; Pechuga; 0.25; kg; caducado
```

#### Formatos naturales (sin separadores):
```
nombre cantidad unidad
cantidad unidad nombre
REF nombre cantidad unidad
nombre cantidad unidad motivo  (para merma)
```

**Ejemplos**:
```
Pechuga de pollo 0.25 kg
0,25 kg Pechuga de pollo
PAN010 Pan burger 12 ud
Pan burger 12 ud quemado
```

#### Separadores alternativos:
También puedes usar `|` o `,` como separadores:
```
ABC123 | Tomate | 10 | kg
ABC123, Tomate, 10, kg
```

#### Unidades aceptadas:
- **Unidades**: `ud`, `unidad`, `unidades`
- **Peso**: `kg`, `kilo`, `kilos`
- **Volumen**: `L`, `l`, `lt`, `litro`, `litros`

#### Notas importantes:
- Si no proporcionas REF, se usa `UNKNOWN` automáticamente.
- Las cantidades pueden usar punto o coma como decimal (`2.5` o `2,5`).
- El parsing es **case-insensitive** para unidades.
- Si el formato es ambiguo, el bot te indicará el formato correcto con un ejemplo.

### API Endpoints

La API NestJS expone los siguientes endpoints:

#### Usuarios
- `GET /health` - Health check
- `POST /users/upsertByTelegramId` - Crear/actualizar usuario

#### Recepciones
- `POST /receptions` - Crear recepción
- `GET /receptions?from=YYYY-MM-DD&to=YYYY-MM-DD` - Listar recepciones

#### Mermas
- `POST /wastages` - Crear merma individual
- `POST /wastages/batch` - Crear merma en lote
- `GET /wastages?from=YYYY-MM-DD&to=YYYY-MM-DD` - Listar mermas

#### Producciones
- `POST /productions` - Crear producción
- `GET /productions?from=YYYY-MM-DD&to=YYYY-MM-DD` - Listar producciones

#### Reportes
- `POST /reports/weekly?from=YYYY-MM-DD&to=YYYY-MM-DD` - Generar reporte PDF

#### Operaciones
- `GET /operations/recent-suppliers` - Obtener proveedores recientes (top 5)
- `GET /operations/recent-batches` - Obtener lotes recientes (top 5)
- `POST /operations/undo` - Deshacer última operación (soft delete)
  ```json
  {
    "chatId": "123456789"
  }
  ```

### Docker (Opcional / Futuro)

Se incluye un `docker-compose.yml` comentado para futuras integraciones (p.ej. PostgreSQL). Actualmente no se requiere base de datos relacional ya que se usa Google Sheets como almacenamiento.

### Estructura de Datos

Los datos se almacenan en Google Sheets con las siguientes columnas:

**users:**
- user_id, telegram_id, name, created_at

**receptions:**
- reception_id, occurred_at, supplier, total, attachment_url, registered_by_user_id, created_at, **created_by_chat_id**, **deleted_at**

**reception_items:**
- item_id, reception_id, ref, product, quantity, unit

**wastages:**
- wastage_id, occurred_at, ref, product, quantity, unit, reason, attachment_url, registered_by_user_id, created_at, **created_by_chat_id**, **deleted_at**

**productions:**
- production_id, occurred_at, batch_name, produced_by_user_id, created_at, **created_by_chat_id**, **deleted_at**

**production_outputs:**
- output_id, production_id, ref, product, quantity, unit

**Notas:**
- `created_by_chat_id`: ID del chat de Telegram que creó el registro (para `/undo`)
- `deleted_at`: Timestamp ISO cuando se marca como eliminado (soft delete). Si está vacío, el registro está activo.

### Características Principales

✨ **UX Mejorada**:
- Botones inline para selección rápida (proveedores, lotes, fechas)
- Autocompletado inteligente con los 5 valores más recientes
- Parsing flexible de items (múltiples formatos aceptados)
- Confirmación visual con opciones de edición
- Deshacer última operación con un solo clic

📊 **Reportes Flexibles**:
- Generación de PDFs con Playwright
- Formatos de fecha flexibles (semana, días, meses, rangos personalizados)
- Botones rápidos para períodos comunes

🗑️ **Soft Delete**:
- Las operaciones se marcan como eliminadas (no se borran físicamente)
- Comando `/undo` para deshacer la última operación
- Los reportes excluyen automáticamente registros eliminados

### Tecnologías

- **Monorepo**: pnpm workspaces
- **API**: NestJS + TypeScript
- **Bot**: Telegraf + TypeScript
- **Almacenamiento**: Google Sheets API v4
- **PDF**: Playwright (HTML to PDF)
- **Validación**: class-validator + class-transformer
- **Linting**: ESLint + Prettier
- **Testing**: Vitest (parser tests)


