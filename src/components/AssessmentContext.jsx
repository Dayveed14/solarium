import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AssessmentContext = createContext(null);

export function AssessmentProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, edit: false, segment: null });
  const navigate = useNavigate();

  // open() sends people to "What are you looking to power?". open({ segment }) goes to the solar page for that kind of customer.
  // The quick calculator (the pop-up) opens only when asked for: open({ manual: true }), or open({ edit: true }) to reload the answers from this tab.
  const open = useCallback((options = {}) => {
    if (options.edit || options.manual) {
      setState({ isOpen: true, edit: Boolean(options.edit), segment: options.segment ?? null });
    } else if (options.segment) {
      navigate(`/assess/solar?who=${options.segment === 'business' ? 'small_business' : 'home'}`);
    } else {
      navigate('/assess');
    }
  }, [navigate]);
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);

  const value = useMemo(() => ({ ...state, open, close }), [state, open, close]);
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used inside <AssessmentProvider>');
  return ctx;
}
