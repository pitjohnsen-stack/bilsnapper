/** Eksporter utvalgte annonser til CSV (nedlasting i nettleser). */

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function downloadDealsCsv(rows: Record<string, unknown>[], filename?: string) {
  const defaultFilename = `bruktbil-utvalg-${todayString()}.csv`;
  const outputFilename = filename ?? defaultFilename;

  const headers = [
    'merke',
    'modell',
    'år',
    'pris_kr',
    'km',
    'farge',
    'drivstoff',
    'eiere',
    'sted',
    'fair_veiledende',
    'confidence',
    'finn_url',
  ];

  const lines = [
    headers.join(';'),
    ...rows.map((car) => {
      const finnUrl =
        (typeof car.url === 'string' && car.url) ||
        (car.finnId || car.id
          ? `https://www.finn.no/car/used/ad.html?finnkode=${car.finnId || car.id}`
          : '');
      const km = car.mileage ?? car.km ?? '';
      const values = [
        car.brand ?? '',
        car.model ?? '',
        car.year ?? '',
        car.price ?? '',
        km,
        car.color ?? '',
        car.fuel ?? '',
        car.owners ?? '',
        car.region ?? car.location ?? '',
        car.fairPrice ?? '',
        car.confidence ?? '',
        finnUrl,
      ];
      return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';');
    }),
  ];

  // UTF-8 BOM ensures correct encoding when opening in Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = outputFilename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
