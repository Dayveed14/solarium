// Small line icons for the home page cards. Decorative: the card text carries the meaning.
const PATHS = {
  assess: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.4-4.4" /><path d="M8.5 11h5M11 8.5v5" /></>,
  plan: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9.5 4V3h5v1M9 11h6M9 15h4" /></>,
  access: <><path d="M5 8h14l-1.2 12H6.2L5 8z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  power: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.1 5.1L4 17l3 3 5.6-5.6a4 4 0 0 0 5.1-5.1l-2.6 2.6-2.4-.5-.5-2.4 2.5-2.7z" />,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2.2h5c0-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z" /></>,
};

export default function Icon({ name, warm = false }) {
  return (
    <span className={`ico${warm ? ' warm' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">{PATHS[name]}</svg>
    </span>
  );
}
