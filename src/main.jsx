import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

window.onerror = function (msg, url, line, col, err) {
  document.body.innerHTML = `<div style="padding:20px;font-family:monospace;color:#b91c1c;background:#fef2f2;min-height:100vh"><h3>Error Terdeteksi:</h3><pre style="white-space:pre-wrap">${msg}\nBaris: ${line}\n${err?.stack || ''}</pre></div>`;
};

window.onunhandledrejection = function (e) {
  document.body.innerHTML = `<div style="padding:20px;font-family:monospace;color:#b91c1c;background:#fef2f2;min-height:100vh"><h3>Promise Error:</h3><pre style="white-space:pre-wrap">${e.reason}</pre></div>`;
};

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  document.body.innerHTML = `<div style="padding:20px;font-family:monospace;color:#b91c1c;background:#fef2f2;min-height:100vh"><h3>Render Error:</h3><pre style="white-space:pre-wrap">${err.stack || err.message}</pre></div>`;
}
