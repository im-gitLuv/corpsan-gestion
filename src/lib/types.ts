/** Tipos compartidos del sistema CorpSan */

/** Un registro del sheet de Talento Humano (clave = key normalizada de columns.ts). */
export type Empleado = Record<string, any> & { _fila?: number };

/** Respuesta estándar del backend de Apps Script. */
export interface ApiResponse {
  ok: boolean;
  msg?: string;
  data?: any;
  headers?: string[];
  [k: string]: any;
}

export type HojaTH = "activos" | "inactivos";

export interface SesionUsuario {
  usuario: string;
  nombre: string;
  rol: string; // por ahora solo "Administrador"
  hora: number; // Date.now() del inicio de sesión
  token?: string; // sesión verificada por el backend para el módulo financiero
  trusted?: boolean;
}
