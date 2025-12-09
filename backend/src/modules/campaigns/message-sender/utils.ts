/**
 * Общие утилиты для отправителей
 */

export function validatePhone(phone: string): void {
  const normalized = phone.replace(/[^\d+]/g, '');
  const isValid = /^\+?\d{7,20}$/.test(normalized);
  if (!isValid) {
    throw new Error('Invalid phone number format');
  }
}


