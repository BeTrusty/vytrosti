// Ledger mathematical validations

export interface UnvalidatedLedgerLine {
  accountPath: string;
  amount: string; // decimal string
  direction: 'debit' | 'credit';
}

// Convert decimal string to integer with 4 decimal places of precision (e.g., "12.3456" -> 123456)
export function parseToPreciseInteger(decimalStr: string): bigint {
  const parsed = parseFloat(decimalStr);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative decimal amount: ${decimalStr}`);
  }
  
  // Use string manipulation to prevent floating point inaccuracies
  const parts = decimalStr.split('.');
  const integerPart = parts[0] || '0';
  let fractionPart = parts[1] || '0';
  
  // Pad or truncate fraction to exactly 4 digits
  if (fractionPart.length < 4) {
    fractionPart = fractionPart.padEnd(4, '0');
  } else {
    fractionPart = fractionPart.substring(0, 4);
  }
  
  return BigInt(integerPart + fractionPart);
}

export function validateLedgerEntry(lines: UnvalidatedLedgerLine[]): void {
  if (lines.length < 2) {
    throw new Error('Ledger entry must contain at least 2 lines (double-entry rule)');
  }

  let totalDebit = 0n;
  let totalCredit = 0n;

  for (const line of lines) {
    const amountVal = parseToPreciseInteger(line.amount);
    if (amountVal <= 0n) {
      throw new Error(`Line amount must be greater than zero. Got: ${line.amount}`);
    }

    if (line.direction === 'debit') {
      totalDebit += amountVal;
    } else if (line.direction === 'credit') {
      totalCredit += amountVal;
    } else {
      throw new Error(`Invalid line direction: ${line.direction}`);
    }
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Unbalanced ledger entry. Total Debits (${totalDebit}) must equal Total Credits (${totalCredit}). Difference: ${
        totalDebit > totalCredit ? totalDebit - totalCredit : totalCredit - totalDebit
      }`
    );
  }
}
