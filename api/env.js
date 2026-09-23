export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript');
  res.status(200).send(
    'window.ENV_EMAILJS_PUBLIC_KEY = ' + JSON.stringify(process.env.EMAILJS_PUBLIC_KEY || '') + ';\n' +
    'window.ENV_EMAILJS_SERVICE_ID = ' + JSON.stringify(process.env.EMAILJS_SERVICE_ID || '') + ';\n' +
    'window.ENV_EMAILJS_TEMPLATE_ID = ' + JSON.stringify(process.env.EMAILJS_TEMPLATE_ID || '') + ';\n' +
    'window.ENV_BUG_REPORT_EMAIL = ' + JSON.stringify(process.env.BUG_REPORT_EMAIL || '') + ';\n'
  );
}
