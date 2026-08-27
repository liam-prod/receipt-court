/**
 * import.js — Bulk indictment from a bank statement.
 *
 * Real bank exports have no agreed format, so rather than demand one we sniff
 * the columns: find the date, the description, and the amount, whatever the
 * bank decided to call them. Credits (refunds, paycheques) are dropped — the
 * court only prosecutes money leaving.
 */

import Papa from 'papaparse';

const DATE_KEYS = ['date', 'transaction date', 'posted date', 'posting date', 'trans date', 'time'];
const DESC_KEYS = ['description', 'merchant', 'name', 'details', 'payee', 'memo', 'transaction', 'narrative'];
const DEBIT_KEYS = ['debit', 'withdrawal', 'withdrawals', 'money out', 'amount debit'];
const CREDIT_KEYS = ['credit', 'deposit', 'deposits', 'money in', 'amount credit'];
const AMOUNT_KEYS = ['amount', 'value', 'transaction amount', 'cad$', 'amount (cad)'];

/** Find the first header whose normalised name matches any candidate. */
function findColumn(headers, candidates) {
  const norm = headers.map((h) => String(h || '').toLowerCase().trim());
  for (const cand of candidates) {
    const i = norm.indexOf(cand);
    if (i !== -1) return headers[i];
  }
  for (const cand of candidates) {
    const i = norm.findIndex((h) => h.includes(cand));
    if (i !== -1) return headers[i];
  }
  return null;
}

const toNumber = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};


/**
 * Pull the spent amount out of a row, or null if the row is not spending.
 * Handles the three layouts banks actually ship:
 *   1. separate Debit / Credit columns
 *   2. one signed Amount column (negative = money out)
 *   3. one unsigned Amount column (every row is a debit)
 */
function extractDebit(row, { debitCol, creditCol, amountCol }) {
  if (debitCol) {
    const debit = toNumber(row[debitCol]);
    if (debit !== null && debit > 0) return debit;
    // An explicit debit column that is blank means this row is a credit.
    if (creditCol || debit !== null) return null;
  }
  if (!amountCol) return null;

  const raw = toNumber(row[amountCol]);
  if (raw === null || raw === 0) return null;

  if (creditCol) {
    const credit = toNumber(row[creditCol]);
    if (credit !== null && credit > 0) return null;
  }
  // Negative means money left the account; positive with no credit column
  // means the export lists debits only.
  return raw < 0 ? Math.abs(raw) : raw;
}

/**
 * Parse a bank CSV into chargeable transactions.
 * Returns { charges, skipped, columns } so the UI can explain what it did.
 */
export function parseStatement(text) {
  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows.length) return { charges: [], skipped: 0, columns: null, error: 'No rows found.' };

  const headers = parsed.meta.fields || [];
  const dateCol = findColumn(headers, DATE_KEYS);
  const descCol = findColumn(headers, DESC_KEYS);
  const debitCol = findColumn(headers, DEBIT_KEYS);
  const creditCol = findColumn(headers, CREDIT_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);

  if (!descCol || (!debitCol && !amountCol)) {
    return { charges: [], skipped: rows.length, columns: null,
      error: `Could not identify columns. Found: ${headers.join(', ')}` };
  }

  const charges = [];
  let skipped = 0;

  for (const row of rows) {
    const merchant = String(row[descCol] ?? '').trim();
    if (!merchant) { skipped++; continue; }

    const amount = extractDebit(row, { debitCol, creditCol, amountCol });
    if (amount === null) { skipped++; continue; }

    const when = dateCol ? new Date(row[dateCol]) : new Date();
    charges.push({
      merchant: merchant.replace(/\s{2,}/g, ' ').slice(0, 60),
      amount: Math.round(amount * 100) / 100,
      date: isNaN(when.getTime()) ? new Date() : when,
    });
  }

  return { charges, skipped, columns: { dateCol, descCol, amountCol: debitCol || amountCol } };
}
