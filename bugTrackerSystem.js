(function(){
  if (typeof emailjs !== 'undefined') {
    const pub = window.ENV_EMAILJS_PUBLIC_KEY || '';
    if (pub) {
      emailjs.init({ publicKey: pub });
    } else {
      console.warn("EmailJS public key is missing (ENV_EMAILJS_PUBLIC_KEY).");
    }
  } else {
    console.error("EmailJS script is not loaded!");
  }
})();

const BUG_CONFIG = {
  reportEndpoint: '/api/report',
  emailConfig: {
    serviceId: window.ENV_EMAILJS_SERVICE_ID || '',
    templateId: window.ENV_EMAILJS_TEMPLATE_ID || ''
  },
  toEmail: window.ENV_BUG_REPORT_EMAIL || ''
};

function logBugReport(description, errorDetails = {}) {
  const bugReport = {
    description: description,
    error: errorDetails.message || 'Manual submission',
    file: errorDetails.filename || 'N/A',
    line: errorDetails.lineno || 'N/A',
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };

  let reports = JSON.parse(localStorage.getItem('limn_offline_bugs') || '[]');
  reports.push(bugReport);
  localStorage.setItem('limn_offline_bugs', JSON.stringify(reports));

  console.log('Bug logged locally. Total queued:', reports.length);

  if (navigator.onLine) {
    syncBugReports();
  }
}

async function syncBugReports() {
  const reports = JSON.parse(localStorage.getItem('limn_offline_bugs') || '[]');
  if (reports.length === 0) return;

  console.log(`Syncing ${reports.length} offline bug report(s)...`);

  try {
    const [discordSuccess, emailSuccess] = await Promise.all([
      sendToDiscord(reports),
      sendToEmail(reports)
    ]);

    if (discordSuccess || emailSuccess) {
      localStorage.removeItem('limn_offline_bugs');
      console.log('Bug reports successfully sent and queue cleared!');
    }
  } catch (error) {
    console.error('Sync attempt failed:', error);
  }
}

async function sendToDiscord(reports) {
  try {
    const response = await fetch(BUG_CONFIG.reportEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: reports })
    });
    return response.ok;
  } catch (error) {
    console.error('Discord forward failed:', error);
    return false;
  }
}

async function sendToEmail(reports) {
  if (typeof emailjs === 'undefined') return false;
  if (!BUG_CONFIG.emailConfig.serviceId || !BUG_CONFIG.emailConfig.templateId) {
    console.warn('EmailJS service/template IDs are not configured.');
    return false;
  }

  const bugSummary = reports.map(r =>
    `Error: ${r.error} | File: ${r.file}:${r.line}`
  ).join('\n');

  try {
    const response = await emailjs.send(
      BUG_CONFIG.emailConfig.serviceId,
      BUG_CONFIG.emailConfig.templateId,
      {
        to_email: BUG_CONFIG.toEmail,
        description: reports[0].description,
        errorDetails: bugSummary,
        timestamp: reports[0].timestamp,
        url: window.location.href
      }
    );
    console.log('EmailJS Success:', response);
    return true;
  } catch (error) {
    console.error('EmailJS Failed to send:', error);
    return false;
  }
}

window.addEventListener('online', () => {
  console.log('Connection restored! Flushing bug report queue...');
  syncBugReports();
});

function createBugButton() {
  if (document.getElementById('limn-bug-btn')) return;

  const bugButton = document.createElement('button');
  bugButton.id = 'limn-bug-btn';
  bugButton.innerText = 'Report a Bug 🐛';
  bugButton.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 9999; padding: 8px 12px; background: #ff4757; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.3);';

  bugButton.addEventListener('click', () => {
    const userDescription = prompt("Briefly describe what went wrong:");
    if (userDescription) {
      logBugReport('User clicked bug button', { message: userDescription });
      alert('Bug report saved! It will be sent automatically when you are online.');
    }
  });

  document.body.appendChild(bugButton);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createBugButton);
} else {
  createBugButton();
}
