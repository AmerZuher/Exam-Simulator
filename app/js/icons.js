/* ExamPro — SVG icon registry (stroke-based, 24x24) */
window.App = window.App || {};

(function () {
  const P = {
    /* Brand mark: a timed seal (ring + clock ticks) around a bold pass
       checkmark — reads as "graded, on the clock", ExamPro's whole pitch. */
    logo: '<circle cx="12" cy="12" r="8.2" stroke-width="1.4"/>' +
          '<path stroke-linecap="round" d="M12 1.7v2.1M12 20.2v2.1M22.3 12h-2.1M3.8 12H1.7"/>' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.8" d="M7.4 12.6l3.3 3.3 6.1-7.2"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    upload: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>',
    study: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.05 12S5.5 5.5 12 5.5 21.95 12 21.95 12 18.5 18.5 12 18.5 2.05 12 2.05 12z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path stroke-linecap="round" stroke-linejoin="round" d="M6 4.75v14.5a.75.75 0 001.14.64l11.9-7.25a.75.75 0 000-1.28L7.14 4.11A.75.75 0 006 4.75z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3.5 2"/>',
    pause: '<path stroke-linecap="round" d="M9 5v14M15 5v14"/>',
    resume: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 4.75v14.5a.75.75 0 001.14.64l11.4-6.95a.75.75 0 000-1.28L8.14 4.11A.75.75 0 007 4.75z"/>',
    flag: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 21V4a1 1 0 011-1h11.6a.5.5 0 01.4.8L14.5 9l3.5 5.2a.5.5 0 01-.4.8H6"/>',
    check: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>',
    x: '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>',
    chevL: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>',
    chevR: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>',
    chevDown: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 9l7 7 7-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.2-3.2"/>',
    star: '<path stroke-linejoin="round" d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4 6.9 19l1.1-5.6-4.2-3.9 5.7-.7L12 3.6z"/>',
    sparkle: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15zM5 2l.8 1.7L7.5 4.5 5.8 5.3 5 7l-.8-1.7L2.5 4.5l1.7-.8L5 2z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path stroke-linecap="round" stroke-linejoin="round" d="M20.35 15.35A9 9 0 018.65 3.65 9 9 0 1012 21a9 9 0 008.35-5.65z"/>',
    menu: '<path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>',
    dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    trash: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12zM10 11v6M14 11v6"/>',
    edit: '<path stroke-linecap="round" stroke-linejoin="round" d="M11 4H5a2 2 0 00-2 2v13a2 2 0 002 2h13a2 2 0 002-2v-6m-1.5-9.5a2.12 2.12 0 013 3L12 16l-4 1 1-4 9.5-9.5z"/>',
    download: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
    arrowR: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m0 0l-6-6m6 6l-6 6"/>',
    link: '<path stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    chart: '<path stroke-linecap="round" d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    history: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.05 11a9 9 0 109-9 9.4 9.4 0 00-6.36 2.64L3 7.5M3 3v4.5h4.5M12 7v5l3.5 2"/>',
    layers: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l9 5-9 5-9-5 9-5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 13l9 5 9-5"/>',
    robot: '<rect x="5" y="9" width="14" height="10" rx="2.5"/><path stroke-linecap="round" d="M12 9V5m0 0h.01M9 14h.01M15 14h.01M9.5 17.5h5"/><circle cx="12" cy="4.5" r="1"/><path stroke-linecap="round" d="M5 13H3m18 0h-2"/>',
    print: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 8V3h10v5M7 17H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-3m-10-3h10v6H7v-6z"/>',
    eyeOff: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.58 10.59A3 3 0 0012 15a3 3 0 002.42-1.24M9.88 5.92A9.5 9.5 0 0112 5.5c6.5 0 9.95 6.5 9.95 6.5a17.6 17.6 0 01-3.18 3.87M6.1 6.1A17.3 17.3 0 002.05 12S5.5 18.5 12 18.5a9.3 9.3 0 003.9-.86"/>',
    refresh: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5.6 9A7.5 7.5 0 0119 7.2L20 8m-.6 7A7.5 7.5 0 015 16.8L4 16"/>',
    grad: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4L2 9l10 5 10-5-10-5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5"/>',
    bolt: '<path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 8h.01M12 11v5"/>',
    warn: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3.5L22 20H2L12 3.5zM12 10v4m0 3h.01"/>',
    book: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 004 4.5v15zM4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
    match: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7h8m-8 5h8m-8 5h5M4 5h.01M4 12h.01M4 19h.01"/>',
    shuffle: '<path stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    home: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5"/>',
    cards: '<rect x="3" y="7" width="13" height="14" rx="2.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 4h10A2.5 2.5 0 0120 6.5v11"/><path stroke-linecap="round" d="M6.5 11.5h6M6.5 15h4"/>',
    flame: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 22a6 6 0 006-6c0-4-3-5.5-3.5-9.5C13 8 12.5 9.5 11 11c-1-1-1.2-2.5-1-4C7.5 8.5 6 12 6 16a6 6 0 006 6z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 22a2.6 2.6 0 002.6-2.6c0-1.7-1.3-2.4-1.5-4.1-.8 1-1.4 1.6-2 2.3-.4-.4-.5-1-.4-1.7-.9.8-1.3 1.9-1.3 3.5A2.6 2.6 0 0012 22z"/>',
    command: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 103 3V6z"/>',
    brain: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 5.5a3 3 0 00-5.6-1.5A2.8 2.8 0 004 6.6a3 3 0 00-.6 4.6A3.2 3.2 0 004 16a3 3 0 003.8 2.9A2.9 2.9 0 0012 18.5m0-13a3 3 0 015.6-1.5A2.8 2.8 0 0120 6.6a3 3 0 01.6 4.6A3.2 3.2 0 0120 16a3 3 0 01-3.8 2.9A2.9 2.9 0 0112 18.5m0-13v13"/>',

    /* ---- subject icons: pickable per question bank ---- */
    flask: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M10 3v5.6L5 17.2A1.8 1.8 0 006.6 20h10.8a1.8 1.8 0 001.6-2.8L14 8.6V3"/><path stroke-linecap="round" d="M7.6 15h8.8"/>',
    code: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.5 8.5L4.5 12l4 3.5M15.5 8.5l4 3.5-4 3.5M13.6 5.2l-3.2 13.6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.3 9.5h17.4M3.3 14.5h17.4"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 3a13.5 13.5 0 000 18 13.5 13.5 0 000-18z"/>',
    briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path stroke-linecap="round" d="M9 7.5V5.9A1.9 1.9 0 0110.9 4h2.2A1.9 1.9 0 0115 5.9v1.6M3 12.6h18"/>',
    heart: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 20.3l-1.4-1.3C6.1 15 3 12.2 3 8.8A4.8 4.8 0 017.8 4c1.6 0 3.1.7 4 1.9l.2.3.2-.3A5 5 0 0116.2 4 4.8 4.8 0 0121 8.8c0 3.4-3.1 6.2-7.6 10.2z"/>',
    calculator: '<rect x="4" y="3" width="16" height="18" rx="2.2"/><path stroke-linecap="round" d="M8 7h8M8 11.6h.01M12 11.6h.01M16 11.6h.01M8 15.1h.01M12 15.1h.01M16 15.1h.01M8 18.6h.01M12 18.6h.01M16 18.6h.01"/>',
    gear: '<circle cx="12" cy="12" r="3.1"/><path stroke-linecap="round" stroke-linejoin="round" d="M18.8 14.4a1.5 1.5 0 00.3 1.7l.1.1a1.9 1.9 0 11-2.7 2.7l-.1-.1a1.5 1.5 0 00-1.7-.3 1.5 1.5 0 00-.9 1.4v.2a1.9 1.9 0 01-3.8 0v-.1a1.5 1.5 0 00-1-1.4 1.5 1.5 0 00-1.7.3l-.1.1a1.9 1.9 0 11-2.7-2.7l.1-.1a1.5 1.5 0 00.3-1.7 1.5 1.5 0 00-1.4-.9h-.2a1.9 1.9 0 010-3.8h.1a1.5 1.5 0 001.4-1 1.5 1.5 0 00-.3-1.7l-.1-.1a1.9 1.9 0 112.7-2.7l.1.1a1.5 1.5 0 001.7.3h.1a1.5 1.5 0 00.9-1.4v-.2a1.9 1.9 0 013.8 0v.1a1.5 1.5 0 00.9 1.4 1.5 1.5 0 001.7-.3l.1-.1a1.9 1.9 0 112.7 2.7l-.1.1a1.5 1.5 0 00-.3 1.7v.1a1.5 1.5 0 001.4.9h.2a1.9 1.9 0 010 3.8h-.1a1.5 1.5 0 00-1.4.9z"/>',
    palette: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 110-18c4.9 0 9 3.5 9 7.9 0 2.4-2 4-4.4 4H15a2 2 0 00-1.4 3.4A1.9 1.9 0 0112 21z"/><circle cx="7.4" cy="11.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.4" r="1.1" fill="currentColor" stroke="none"/>',
    database: '<ellipse cx="12" cy="6" rx="7.8" ry="3"/><path stroke-linecap="round" d="M4.2 6v12c0 1.66 3.5 3 7.8 3s7.8-1.34 7.8-3V6M4.2 12c0 1.66 3.5 3 7.8 3s7.8-1.34 7.8-3"/>',
    shield: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7.5 3v5.6c0 4.4-3.1 8.1-7.5 9.4-4.4-1.3-7.5-5-7.5-9.4V6L12 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.2 11.9l2.1 2.1 3.9-4.2"/>',
    chat: '<path stroke-linecap="round" stroke-linejoin="round" d="M20 14.2a2.5 2.5 0 01-2.5 2.5H8.2L4 20.5V6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7.7z"/><path stroke-linecap="round" d="M8.5 8.6h7M8.5 12h4.5"/>',
    music: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 18V5.6l11-2V16"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="17.4" cy="16" r="2.6"/>',
    leaf: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5s-.5-8.5 7.5-12.5c3.8-1.9 8-2 8-2s.2 5.2-1.9 8.3c-3 4.4-7.9 5-9.9 5H4.5z"/><path stroke-linecap="round" d="M4.5 19.5c2-5 5.8-8.8 10.5-11"/>',
    rocket: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 2.6c3 2 4.6 5.2 4.6 8.5 0 2.4-.8 4.3-1.3 5.3H8.7c-.5-1-1.3-2.9-1.3-5.3 0-3.3 1.6-6.5 4.6-8.5z"/><circle cx="12" cy="10.1" r="1.8"/><path stroke-linecap="round" stroke-linejoin="round" d="M8.7 16.4l-2.6 2.2c-.5.4-.2 1.1.4 1.2l2.1.3M15.3 16.4l2.6 2.2c.5.4.2 1.1-.4 1.2l-2.1.3"/>',
    lightbulb: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3a6 6 0 00-3.6 10.8c.7.5 1.1 1.3 1.1 2.1h5c0-.8.4-1.6 1.1-2.1A6 6 0 0012 3z"/><path stroke-linecap="round" d="M9.5 18.4h5M10.6 21h2.8"/>'
  };

  /* The set offered when picking a bank's icon (5 × 5 grid). */
  App.bankIcons = [
    "grad", "book", "layers", "cards", "brain",
    "target", "chart", "bolt", "sparkle", "star",
    "flask", "code", "globe", "briefcase", "heart",
    "calculator", "gear", "palette", "database", "shield",
    "chat", "music", "leaf", "rocket", "lightbulb"
  ];

  /* Tones reuse the semantic theme tokens, so they track light/dark + accent. */
  App.bankTones = ["acc", "teal", "ok", "warn", "bad"];

  App.icon = function (name, size, sw) {
    const s = size || 18;
    const w = sw || 1.8;
    const d = P[name] || P.info;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" aria-hidden="true">' + d + "</svg>";
  };
})();
