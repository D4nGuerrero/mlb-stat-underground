import { useEffect, useState } from 'react';

const DEFAULT_TITLE = 'MLB • Live';

let nextId = 0;
const titles = new Map();

function applyTitle() {
  const stacked = [...titles.values()];
  document.title = stacked.at(-1) || DEFAULT_TITLE;
}

export function useDocumentTitle(title) {
  const [id] = useState(() => {
    nextId += 1;
    return nextId;
  });

  useEffect(() => {
    titles.set(id, title ? `${title} · MLB Live` : DEFAULT_TITLE);
    applyTitle();
    return () => {
      titles.delete(id);
      applyTitle();
    };
  }, [id, title]);
}
