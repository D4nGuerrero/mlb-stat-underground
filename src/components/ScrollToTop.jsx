import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;

    // Instant reset (feels snappiest for data-heavy pages)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    // Or smooth if you prefer:
    // window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname, navigationType]);

  return null;
}
