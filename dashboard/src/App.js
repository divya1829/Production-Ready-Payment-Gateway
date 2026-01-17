import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import WebhookConfig from './pages/WebhookConfig';
import APIDocs from './pages/APIDocs';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav>
          <Link to="/dashboard/webhooks">Webhooks</Link>
          <Link to="/dashboard/docs">API Documentation</Link>
        </nav>
        <Routes>
          <Route path="/dashboard/webhooks" element={<WebhookConfig />} />
          <Route path="/dashboard/docs" element={<APIDocs />} />
          <Route path="/" element={<WebhookConfig />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
