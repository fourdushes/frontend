import { useState } from 'react';

import { readableError } from '../api/client';

export function useAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<unknown>();

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      setValue(result);
      return result;
    } catch (caught) {
      setError(readableError(caught));
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, value, run };
}
