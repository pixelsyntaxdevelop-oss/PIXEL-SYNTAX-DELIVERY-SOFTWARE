export function normalizeAndValidateUaeMobile(phone: string): { valid: boolean; normalized: string; code?: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', code: 'INVALID_PHONE_FORMAT', error: 'INVALID_PHONE_FORMAT: Mobile phone number is required.' };
  }
  // Remove spaces, dashes, parentheses, dots
  const stripped = phone.replace(/[\s\-\(\)\.]/g, '').trim();
  if (!stripped) {
    return { valid: false, normalized: '', code: 'INVALID_PHONE_FORMAT', error: 'INVALID_PHONE_FORMAT: Mobile phone number cannot be empty.' };
  }

  let normalized = '';
  if (stripped.startsWith('+971')) {
    const rest = stripped.substring(4);
    if (/^\d+$/.test(rest)) {
      normalized = `+971${rest}`;
    }
  } else if (stripped.startsWith('00971')) {
    const rest = stripped.substring(5);
    if (/^\d+$/.test(rest)) {
      normalized = `+971${rest}`;
    }
  } else if (stripped.startsWith('971')) {
    const rest = stripped.substring(3);
    if (/^\d+$/.test(rest)) {
      normalized = `+971${rest}`;
    }
  } else if (stripped.startsWith('05')) {
    // 05XXXXXXXX -> +9715XXXXXXXX
    const rest = stripped.substring(1);
    if (/^\d+$/.test(rest)) {
      normalized = `+971${rest}`;
    }
  } else if (stripped.startsWith('5') && stripped.length === 9) {
    if (/^\d+$/.test(stripped)) {
      normalized = `+971${stripped}`;
    }
  }

  // Must match UAE mobile format: +971 5X XXX XXXX (9 digits after +971, starting with 5)
  if (!normalized || !/^\+9715\d{8}$/.test(normalized)) {
    return {
      valid: false,
      normalized: '',
      code: 'INVALID_PHONE_FORMAT',
      error: `INVALID_PHONE_FORMAT: '${phone}' does not match required UAE mobile format (+971 5X XXX XXXX).`,
    };
  }

  return { valid: true, normalized };
}

export function normalizeAndValidateUaeMobileForWorker(phone: string): { valid: boolean; normalized: string; code?: string; error?: string } {
  // Simple check that doesn't rely on complex regex for speed
  const stripped = String(phone).replace(/[\s\-\(\)\.]/g, '').trim();
  
  let normalized = '';
  // Try common prefixes
  if (stripped.startsWith('+971')) normalized = stripped;
  else if (stripped.startsWith('00971')) normalized = '+971' + stripped.substring(5);
  else if (stripped.startsWith('971')) normalized = '+971' + stripped.substring(3);
  else if (stripped.startsWith('05')) normalized = '+971' + stripped.substring(1);
  else if (stripped.length === 9 && stripped.startsWith('5')) normalized = '+971' + stripped;
  else if (stripped.length === 12 && stripped.startsWith('9715')) normalized = '+' + stripped;

  if (normalized.length === 13 && normalized.startsWith('+9715')) {
      return { valid: true, normalized };
  }
  return { valid: false, normalized: '', error: 'INVALID' };
}

export function normalizeUaePhoneNumber(phone: string): string {
  const res = normalizeAndValidateUaeMobile(phone);
  if (res.valid) return res.normalized;
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}
