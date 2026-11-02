> La bitácora financiera con cifras reales se conserva únicamente en el equipo local y se excluye de Git.

# CorpSan — Sistema de Gestión Administrativa

Actualización del 29/10/2026: estados bidireccionales auditados, saldos editables por cuenta, métodos de pago normalizados, reportes separados por titularidad y semanas empresariales de sábado a viernes. Criterios y pruebas: [REQUISITOS-2026-10-29.md](REQUISITOS-2026-10-29.md).

Sistema de gestión administrativa de **Corporación Santamaría, C.A.** (RIF J-31290505-0, Maturín, Estado Monagas), desarrollado como proyecto de pasantías. Fase preliminar: módulo de **Talento Humano** con acceso por rol de **Administrador**, sincronizado con la base de datos **BD TALENTO HUMANO** en Google Sheets mediante **Google Apps Script**.

## Arquitectura

```
Navegador → Next.js (Vercel) → Google Apps Script (backend) → Google Sheets (BD TALENTO HUMANO)
```

- **Frontend:** Next.js 15 + React 19 + TypeScript (sin librerías externas de UI; CSS propio portado del template `index.html`).
- **Backend:** Google Apps Script desplegado como Aplicación Web. La hoja de cálculo es la base de datos; no hay servidores ni bases de datos externas.
- **Alojamiento:** Vercel (plan gratuito), compartido por link.

## Estructura del proyecto

```
WebApp/
├── apps-script/Code.gs        ← Backend para pegar en Extensiones → Apps Script
├── public/                    ← Logos CorpSan
├── src/
│   ├── app/
│   │   ├── page.tsx           ← Landing corporativa + login
│   │   ├── globals.css        ← Identidad visual CorpSan (amarillo #FDB913 / Barlow)
│   │   └── dashboard/
│   │       ├── layout.tsx     ← Shell del panel (sidebar, topbar, guardia de sesión)
│   │       ├── page.tsx       ← Resumen (KPIs, nómina, cumpleaños)
│   │       ├── talento-humano/← CRUD del personal (activos / inactivos)
│   │       └── configuracion/ ← Conexión con Apps Script
│   ├── components/            ← RecordModal (expediente de 54 campos), toasts, iconos
│   └── lib/                   ← api, auth, store, columns (mapa del sheet), demo
├── package.json
└── .env.example
```

## Desarrollo local

Requiere Node.js 18.18+ (probado con Node 26).

```bash
cd WebApp
npm install
npm run dev          # http://localhost:3000
```

Desarrollo guarda sus archivos generados en `.next-dev`; compilación y producción usan `.next`. Mantén un solo servidor en el puerto 3000. Detén el anterior con Ctrl+C antes de arrancar otro. Después de cambiar entre desarrollo y producción, recarga el navegador con Ctrl+F5 para renovar los archivos de la página.

Sin backend configurado, la app corre en **modo demo** con datos ficticios (login: `admin` / `admin123`).

## PASO A PASO — Qué debes hacer tú

### Paso 1 · Probar la app en local (5 min)

1. Abre una terminal en la carpeta `WebApp` y ejecuta `npm install` (solo la primera vez) y luego `npm run dev`.
2. Abre `http://localhost:3000` en el navegador.
3. Inicia sesión con `admin` / `admin123`. Verás el panel en **modo demo local** (datos ficticios).
4. Entra a **Talento Humano**, prueba crear, editar y eliminar registros. Nada toca tu hoja real.

### Paso 2 · Instalar el backend en tu hoja de Google (10 min)

1. Abre la hoja **BD TALENTO HUMANO**: <https://docs.google.com/spreadsheets/d/1TQof8laewXba6mSnXEvKda_45npHcTlEwHWdqptaIos/edit>
2. Menú **Extensiones → Apps Script**.
3. Borra el contenido del editor, pega el contenido completo de `apps-script/Code.gs` y guarda (Ctrl+S).
4. Ejecuta una vez la función `prepararCodigoInicial` desde el editor. Copia el código de instalación del registro de ejecución y consérvalo de forma privada. No lo agregues al repositorio.
5. Click en **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**
   - Descripción: `CorpSan Gestión v1`
   - Ejecutar como: **yo** (tu cuenta)
   - Quién tiene acceso: **cualquier usuario** ← necesario para que la web funcione sin login de Google
6. Autoriza los permisos del script en tu cuenta de Google.
7. Copia la **URL de la aplicación web** (termina en `/exec`).

En una implementación existente, usa **Gestionar implementaciones → editar → Nueva versión** para conservar la URL. Publica el backend antes de actualizar la interfaz web, pues el acceso nuevo requiere sus rutas de autenticación.

### Primer administrador y cuentas siguientes

1. En la portada, pulsa **Iniciar sesión → Crear cuenta**. La primera cuenta solicita el código de instalación y se activa como **Administrador**.
2. Las cuentas creadas después se guardan en la pestaña `USUARIOS` como **Pendiente**. Solo un administrador puede activarlas desde **Configuración → Usuarios y acceso**. Todas las cuentas activadas tienen acceso completo por ahora.
3. `USUARIOS` guarda usuario, nombre, rol, estado, sal y verificador; nunca la contraseña legible. El navegador deriva una clave con PBKDF2-HMAC-SHA256 (600.000 iteraciones) y Apps Script almacena un HMAC adicional con un secreto de Propiedades del script.
4. **Cambiar mi contraseña** está en Configuración y cierra la sesión al guardarla.

### Paso 3 · Conectar la app con tu hoja (2 min)

1. Con `npm run dev` corriendo, inicia sesión y ve a **Configuración**.
2. Pega la URL `/exec` y pulsa **Probar conexión**.
3. Debe aparecer **● Conectado a Google Sheets** y el módulo Talento Humano cargará tu personal real (solo lectura de estructura: 54 columnas).
4. Prueba crear/editar/eliminar y verifica que los cambios aparecen en el sheet. **Importante:** guarda primero una copia de respaldo (Archivo → Descargar → .xlsx).

> La URL se guarda en el navegador (localStorage). El botón **Desconectar** vuelve al modo demo.

### Paso 4 · Subir a GitHub y desplegar en Vercel (15 min)

1. **GitHub:** crea un repositorio **privado** (la app es interna de la empresa) y súbelo:

   ```bash
   cd WebApp
   git init
   git add .
   git commit -m "CorpSan Gestión Administrativa v0.1"
   git branch -M main
   git remote add origin https://github.com/im-gitLuv/corpsan-gestion.git
   git push -u origin main
   ```

   (No subas `.env.local` ni datos reales; el `.gitignore` ya lo cubre.)

2. **Vercel:** entra a <https://vercel.com> con tu cuenta de GitHub → **Add New → Project** → importa el repositorio `corpsan-gestion`.
   - Framework: **Next.js**. Directorio raíz: **`./`** (el repositorio contiene directamente la webapp).
   - Compilación: `npm run build`. Instalación: `npm ci`. Directorio de salida: predeterminado de Next.js.
   - Rama de producción: `main`. Conserva activadas las implementaciones de vista previa para revisar cambios en otras ramas.
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_APPS_SCRIPT_URL` = la URL `/exec` del Paso 2.
4. Click en **Deploy**. En un minuto tendrás el link público (`https://corpsan-gestion.vercel.app`) para compartir con la administradora.
5. Aunque la variable esté definida, cada quien puede pegar su propia URL desde **Configuración** (tiene prioridad local); útil si cambias la implementación del backend.

### Paso 5 · Buenas prácticas antes del uso real

- **Respaldo:** descarga el sheet como .xlsx antes de cada sesión de edición masiva.
- **Cuentas:** suspende las que ya no necesiten acceso y usa contraseñas únicas de al menos 12 caracteres.
- **Datos sensibles:** la base contiene cédulas, cuentas bancarias y salarios. Comparte el link de Vercel solo con personal autorizado y evita capturas de pantalla.
- **Edición simultánea:** si alguien edita el sheet directamente mientras la app está abierta, la app detecta el cambio de filas (verificación por cédula) y te pide recargar en vez de sobrescribir.

## Estructura del sheet que espera el backend

Pestañas **BD PERSONAL ACTIVO** e **INACTIVOS**:

- Fila 7 = grupos (DATOS GENERALES, CONSTANCIA FISICA…), fila 8 = subencabezados (FISCO/DIGITAL), datos desde la **fila 9**.
- 54 columnas en este orden (constantes `KEYS` en `Code.gs` y `COLS` en `src/lib/columns.ts`):

  N°, NOMBRE Y APELLIDO, CEDULA, RIF, SEXO, FECHA NACIM., CARGO, TELEFONO, DIRECCIÓN, CORREO · 6 documentos × (FISCO, DIGITAL) · BANCO, N° CUENTA · contacto de emergencia (2) · CARGO, SUPERVISOR, JORNADA, TIPO NOMINA, INGRESO REAL, INGRESO IVSS · salario, sueldo, bono, ayuda, total, comisiones, bono vacacional, otros, comentarios · año · 12 meses de validación de recibos.

Si algún día cambias la estructura del sheet, ajusta **en el mismo orden** `KEYS` (Code.gs) y `COLS` (columns.ts).

## Roadmap de módulos (según hoja de requerimientos de la pasantía)

- ✅ Talento Humano (activos/inactivos, CRUD, expediente completo)
- ✅ Login por rol — fase preliminar: solo Administrador
- ⬜ Roles RRHH / Tesorería / Supervisor (permisos por acción)
- ⬜ Nómina y pagos
- ⬜ Inventario y equipos (propios/alquilados, soportes)
- ⬜ Proveedores, facturas y conciliaciones
- ⬜ Reportes gerenciales y exportación

## Notas de seguridad

- Las operaciones privadas de Apps Script requieren un token de sesión temporal. La ruta pública de registro no da acceso directo después de crear cuentas nuevas; requiere aprobación.
- El Web App de Apps Script permite llegar al formulario desde Internet, pero las rutas de datos validan la sesión. Restringe quién puede editar la hoja y el proyecto de Apps Script; quienes tienen acceso directo a ellos están fuera del control de roles de la webapp.
