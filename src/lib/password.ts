/** PBKDF2 en el navegador. El backend guarda solo un HMAC del resultado. */
export const PASSWORD_ITERATIONS = 600000;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function passwordProof(password: string, salt: string): Promise<string> {
  if (!/^[a-f0-9]{32}$/.test(salt)) throw new Error("La configuración de seguridad no es válida.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(salt.match(/.{2}/g)!, pair => parseInt(pair, 16)), iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(bits));
}

export function validatePassword(password: string): string {
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (password.length > 128) return "La contraseña no puede superar 128 caracteres.";
  return "";
}
