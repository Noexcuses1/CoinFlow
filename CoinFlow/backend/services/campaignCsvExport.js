import { listApprovedUsersForExport } from '../repositories/campaignUsersRepository.js';

const headers = [
  'telegram_id',
  'telegram_username',
  'wallet_address',
  'x_username',
  'points',
  'referrals_count',
  'verification_status',
  'airdrop_amount',
  'created_at',
];

export async function buildApprovedUsersCsv() {
  const rows = await listApprovedUsersForExport();
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    csvRows.push(headers.map((header) => escapeCsv(row[header])).join(','));
  }

  return csvRows.join('\n');
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
