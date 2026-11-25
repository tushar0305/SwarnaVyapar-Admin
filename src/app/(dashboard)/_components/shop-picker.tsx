'use client';

import { useEffect, useState } from 'react';
import { searchShops } from '@/services/shop-management.service';
import { Input } from '@/components/ui/input';

export function ShopPicker({
  shopId,
  shopName,
  onChange,
}: {
  shopId: string;
  shopName?: string;
  onChange: (shop: { id: string; name: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchShops(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative">
      {shopId ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-2">
          <p className="min-w-0 truncate text-sm font-medium text-ink-900">
            {shopName || 'Selected shop'}
          </p>
          <button
            type="button"
            className="text-xs font-medium text-gold-700 hover:underline"
            onClick={() => {
              onChange({ id: '', name: '' });
              setQuery('');
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search shop name, phone, or email"
          aria-label="Search shop"
        />
      )}
      {open && !shopId && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-ink-200 bg-white py-1 shadow-sm">
          {results.map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-ink-50"
                onClick={() => {
                  onChange(shop);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {shop.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
