/** Eksporter utvalgte annonser til CSV (nedlasting i nettleser). */

export function downloadDealsCsv(rows: Record<string, unknown>[], filename = 'bruktbil-utvalg.csv') {
  const headers = [
    'merke',
    'modell',
    'år',
    'pris_kr',
    'km',
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
        car.region ?? car.location ?? '',
        car.fairPrice ?? '',
        car.confidence ?? '',
        finnUrl,
      ];
      return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
