import { RawBLProductsResponse } from '@/types/app';

export interface ProductLine {
  reference: string;
  quantityExpected?: number;
}

const REF_KEYS = ['reference', 'REFERENCE', 'Ref', 'REF'];
const QTY_KEYS = ['Q_LIV', 'q_liv', 'QLIV', 'qte', 'QTE', 'quantite', 'QUANTITE', 'QteBL', 'QTEBL', 'Qte'];

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function mapProducts(raw: RawBLProductsResponse): ProductLine[] {
  const seen = new Set<string>();
  const result: ProductLine[] = [];

  for (const row of raw.data) {
    const refRaw = firstValue(row, REF_KEYS);
    if (!refRaw) {
      continue;
    }

    const reference = String(refRaw).trim();
    if (!reference || seen.has(reference)) {
      continue;
    }

    seen.add(reference);

    result.push({
      reference,
      quantityExpected: toNumber(firstValue(row, QTY_KEYS)),
    });
  }

  return result;
}
