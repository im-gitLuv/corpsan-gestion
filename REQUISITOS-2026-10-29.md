# Validación de RF-01 a RF-05 · 29/10/2026

Pruebas reproducibles: `npm test`. Compilación: `npm run build`.
Las pruebas de escritura usan hojas simuladas; no cambian empleados ni importes reales.

| Requisito y criterio | Verificación |
|---|---|
| RF-01: reactivar y escribir Activo | Prueba del backend con hoja simulada; acción React conectada a `th_estado`. |
| RF-01: desactivar con confirmación | Mismo flujo bidireccional; confirmación también al editar el estado desde la ficha. |
| RF-01: cambios desde Sheets | `onEdit` registra el cambio; sincronización al volver a la pestaña o actualizar datos, sin caché de lectura. |
| RF-01: listados, selectores y cálculos | El contexto compartido actualiza activos/inactivos; nómina y resumen consumen ese contexto. No se altera la fórmula de IVSS que cuenta lunes. |
| RF-01: quién, cuándo y antes/después | `TH_BITACORA`: fecha, usuario, cédula, anterior, nuevo, origen, hoja y fila. Prueba de origen webapp y sheet. Google puede omitir la identidad del editor en el evento: se registra “No disponible (Google)”, sin inventarla. |
| RF-02: cualquier mes y cascada por cuenta | Prueba de 14 meses, cruce de año, cuentas aisladas y sustitución de correcciones posteriores. |
| RF-02: vista anual | Doce meses; edición hasta el mes actual. Meses anteriores al inicio o futuros no editables. |
| RF-02: persistencia en Sheets | `FIN_AJUSTES_SALDO` conserva historial; `FIN_SALDOS` guarda valores mensuales recalculados. Verificado con hojas simuladas. |
| RF-02: vista previa | El servidor devuelve meses afectados y revisión de datos; rechaza una confirmación si cambió la fuente después de la vista previa. |
| RF-02: historial y discrepancias | Valor anterior/nuevo, fecha, usuario, motivo y saldo oficial opcional. Se permite corregir aun con discrepancia. Sin saldo oficial se indica que el cotejo está pendiente. |
| RF-03: registrar Pago Móvil y Tarjeta de Débito | Catálogo extensible en formulario, selección en históricos y flujo común de conciliación. |
| RF-03: filtrar por método | Filtro y subtotales propios. |
| RF-03: reconocer variantes | PM, pago movil, débito y TARJETA DEBITO, entre otras. Original intacto al leer; primera corrección conserva su valor en FIN_METODOS_ORIGINALES y auditoría. |
| RF-03: subtotales | HTML y CSV incluyen ingresos y egresos por método; pruebas de sumas. |
| RF-04: mes cerrado separado | Generador acepta un tipo único. “Emitir los dos” solicita dos documentos independientes. |
| RF-04: semana y rango libre | Ambos usan la misma selección de titularidad; pruebas por cada modo y tipo. |
| RF-04: banco y titularidad visibles | Columnas explícitas en HTML y CSV; nombres pulidos sin cambiar los identificadores de cuenta. |
| RF-04: totales por cuenta | Cálculo por cuenta, agregado solo dentro del tipo elegido. Bases ausentes se muestran pendientes, nunca como cero. |
| RF-04: impedir mezcla | Validación en backend y en exportadores; pruebas de rechazo de cuentas cruzadas, movimientos ajenos y escape HTML/CSV. |
| RF-05: ancla y límites | 05/01 → 1, 10/01 → 2, 31/12 → 52; 01–02/01 pertenecen a 2025. Prueba diaria de 2024 a 2030 e inversa. |
| RF-05: sábado a viernes | Calendario, selectores, agrupaciones y documentos usan la utilidad compartida. |
| RF-05: sin semanas ISO | `inicioSemana` delega a `getBusinessWeek`; el conteo de lunes de IVSS se conserva porque es una fórmula de nómina, no un calendario semanal. |
| RF-05: formato visible | “Semana N (dd/mm – dd/mm)” en consulta y reportes. |

## Datos conectados y publicación

Se leyó el backend antes y después de publicar la versión 10 de Apps Script, conservando su URL. La comparación confirmó los mismos 4.648 movimientos, ocho cuentas, categorías y 42 cédulas (12 activas y 30 inactivas). Se comprobó una vista previa de diez meses sin guardarla y el rechazo de una sesión inválida. La revisión final quedó publicada como versión 11, con lectura de fechas optimizada para evitar consultas repetidas a la zona horaria y filtrado previo del personal.

Se verificaron en la interfaz conectada las semanas sábado–viernes, los nombres de bancos, el filtro Pago Móvil, la tabla anual y la vista previa cancelada. Se generaron dos reportes reales de agosto, Personal y Jurídico, cuyas vistas previas se comprobaron separadas. No se modificaron movimientos, estados ni saldos reales al realizar esas comprobaciones. GitHub y Vercel confirmaron la publicación de la interfaz en la dirección habitual.

Se inicializó `TH_ESTADOS` desde la base existente para conocer el estado anterior en pegados de varias celdas. El disparador simple `onEdit` usa el archivo vinculado; no crea permisos nuevos. Si Google no suministra identidad del editor, la auditoría lo declara.

No se reactivó personal real ni se corrigieron saldos oficiales como prueba. La comprobación operativa de esas escrituras debe realizarse con un cambio real confirmado por Mayerling; las validaciones automatizadas de escritura no equivalen a aceptación de la usuaria.

## Mantenimiento

`src/lib/business.ts` es la fuente compartida de semanas, métodos, cuentas, saldos y selección de reportes. `npm run sync:domain` la transpila e integra, junto con `apps-script/features.js`, al final de `apps-script/Code.gs`. `node scripts/sync-domain.cjs --check` detecta divergencias. Para Apps Script se publica **solo Code.gs**, evitando duplicar las funciones.

Las copias anteriores de FIN_CIERRES se conservan; los reportes nuevos se guardan en FIN_REPORTES como versiones independientes por tipo y rango. Una corrección no altera documentos ya emitidos: generar nuevamente produce una nueva revisión con los saldos vigentes. Cuando el rango cruza correcciones de saldo, estas aparecen aparte de los ingresos y egresos. PDF usa impresión; Excel usa CSV, conservando los formatos previos.
