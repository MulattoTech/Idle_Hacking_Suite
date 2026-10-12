'use strict';
globalThis.IHS2UI=globalThis.IHS2UI||{};
IHS2UI.statusClass=function(text){const s=String(text||'').toLowerCase();if(/rate/.test(s))return'status-rate-limited';if(/run|active|connected|ready|healthy/.test(s))return'status-running';if(/cool/.test(s))return'status-cooldown';if(/block|need|full/.test(s))return'status-blocked';if(/disable|off/.test(s))return'status-disabled';if(/error|fail/.test(s))return'status-error';return'status-waiting';};
