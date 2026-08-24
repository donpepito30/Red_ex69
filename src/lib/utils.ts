import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
  Sanea cadenas de texto simples removiendo etiquetas HTML peligrosas, 
  caracteres de control y espacios invisibles.
 */
export function sanitizeInput(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>?/gm, '') // Elimina etiquetas HTML (<script>, etc.)
    .replace(/[\0\x08\x09\x1a]/g, '') // Elimina caracteres de control
    .trim()
    .slice(0, maxLength);
}

/**
  Sanea parámetros de consulta (URL Query Params) permitiendo únicamente 
  caracteres alfanuméricos y puntuación común segura.
 */
export function sanitizeQueryParam(param: string): string {
  if (!param || typeof param !== 'string') return '';
  return param
    .replace(/[^\w\s\-\.,ñáéíóúÁÉÍÓÚ]/gi, '')
    .trim();
}
