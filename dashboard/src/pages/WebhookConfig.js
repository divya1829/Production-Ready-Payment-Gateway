import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WebhookConfig.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function WebhookConfig() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('whsec_test_abc123');
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWebhookLogs();
  }, []);

  const fetchWebhookLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/webhooks`, {
        headers: {
          'X-Api-Key': 'key_test_abc123',
          'X-Api-Secret': 'secret_test_xyz789',
        },
        params: { limit: 50, offset: 0 },
      });
      setWebhookLogs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // In a real implementation, this would call an API to update webhook configuration
    alert('Webhook configuration saved (implementation needed)');
  };

  const handleRegenerateSecret = () => {
    const newSecret = 'whsec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setWebhookSecret(newSecret);
  };

  const handleTestWebhook = async () => {
    // In a real implementation, this would trigger a test webhook
    alert('Test webhook sent (implementation needed)');
  };

  const handleRetry = async (webhookId) => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/api/v1/webhooks/${webhookId}/retry`, {}, {
        headers: {
          'X-Api-Key': 'key_test_abc123',
          'X-Api-Secret': 'secret_test_xyz789',
        },
      });
      fetchWebhookLogs();
    } catch (error) {
      console.error('Error retrying webhook:', error);
      alert('Failed to retry webhook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="webhook-config" data-test-id="webhook-config">
      <h2>Webhook Configuration</h2>

      <form data-test-id="webhook-config-form" onSubmit={handleSave}>
        <div className="form-group">
          <label>Webhook URL</label>
          <input
            data-test-id="webhook-url-input"
            type="url"
            placeholder="https://yoursite.com/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Webhook Secret</label>
          <div className="secret-display">
            <span data-test-id="webhook-secret">{webhookSecret}</span>
            <button
              data-test-id="regenerate-secret-button"
              type="button"
              onClick={handleRegenerateSecret}
            >
              Regenerate
            </button>
          </div>
        </div>

        <button data-test-id="save-webhook-button" type="submit">
          Save Configuration
        </button>

        <button
          data-test-id="test-webhook-button"
          type="button"
          onClick={handleTestWebhook}
        >
          Send Test Webhook
        </button>
      </form>

      <h3>Webhook Logs</h3>
      <table data-test-id="webhook-logs-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Last Attempt</th>
            <th>Response Code</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {webhookLogs.map((log) => (
            <tr key={log.id} data-test-id="webhook-log-item" data-webhook-id={log.id}>
              <td data-test-id="webhook-event">{log.event}</td>
              <td data-test-id="webhook-status">{log.status}</td>
              <td data-test-id="webhook-attempts">{log.attempts}</td>
              <td data-test-id="webhook-last-attempt">
                {log.last_attempt_at ? new Date(log.last_attempt_at).toLocaleString() : '-'}
              </td>
              <td data-test-id="webhook-response-code">{log.response_code || '-'}</td>
              <td>
                {log.status === 'failed' && (
                  <button
                    data-test-id="retry-webhook-button"
                    data-webhook-id={log.id}
                    onClick={() => handleRetry(log.id)}
                    disabled={loading}
                  >
                    Retry
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default WebhookConfig;
