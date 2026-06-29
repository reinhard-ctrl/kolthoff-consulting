import { useState, useEffect } from 'react';
import { onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { CollectionReference } from 'firebase/firestore';

export function useFirestoreCollection<T extends DocumentData>(col: CollectionReference) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(col, (snap: QuerySnapshot) => {
      const items: (T & { id: string })[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as T) }));
      setData(items);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [col]);

  return { data, loading };
}
