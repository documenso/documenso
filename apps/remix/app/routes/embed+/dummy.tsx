/**
 * This is an internal test page for the embedding system.
 *
 * We use this to test embeds for E2E testing.
 *
 * No translations required.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router';

export const loader = () => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('This page is only available in development mode.');
  }
};

/**
 * Dummy embed test page.
 *
 * Simulates an embedding parent that renders the V2 authoring iframe
 * with configurable features, externalId, and mode.
 *
 * Navigate to /embed/dummy to use.
 */
export default function EmbedDummyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState(() => searchParams.get('token') || '');
  const [externalId, setExternalId] = useState(() => searchParams.get('externalId') || '');
  const [mode, setMode] = useState<'create' | 'edit'>(
    () => (searchParams.get('mode') as 'create' | 'edit') || 'create',
  );
  const [envelopeId, setEnvelopeId] = useState(() => searchParams.get('envelopeId') || '');
  const [envelopeType, setEnvelopeType] = useState<'DOCUMENT' | 'TEMPLATE'>(
    () => (searchParams.get('envelopeType') as 'DOCUMENT' | 'TEMPLATE') || 'DOCUMENT',
  );

  // Auto-launch if query params are present on mount
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);

  // Feature flags state -- grouped by section
  const [generalFeatures, setGeneralFeatures] = useState({
    allowConfigureEnvelopeTitle: true,
    allowUploadAndRecipientStep: true,
    allowAddFieldsStep: true,
    allowPreviewStep: true,
    minimizeLeftSidebar: true,
  });

  const [settingsFeatures, setSettingsFeatures] = useState({
    allowConfigureSignatureTypes: true,
    allowConfigureLanguage: true,
    allowConfigureDateFormat: true,
    allowConfigureTimezone: true,
    allowConfigureRedirectUrl: true,
    allowConfigureDistribution: true,
  });

  const [actionsFeatures, setActionsFeatures] = useState({
    allowAttachments: true,
    allowDistributing: false,
    allowDirectLink: false,
    allowDuplication: false,
    allowDownloadPDF: false,
    allowDeletion: false,
    allowReturnToPreviousPage: false,
  });

  const [envelopeItemsFeatures, setEnvelopeItemsFeatures] = useState({
    allowConfigureTitle: true,
    allowConfigureOrder: true,
    allowUpload: true,
    allowDelete: true,
  });

  const [recipientsFeatures, setRecipientsFeatures] = useState({
    allowAIDetection: true,
    allowConfigureSigningOrder: true,
    allowConfigureDictateNextSigner: true,
    allowApproverRole: true,
    allowViewerRole: true,
    allowCCerRole: true,
    allowAssistantRole: true,
  });

  const [fieldsFeatures, setFieldsFeatures] = useState({
    allowAIDetection: true,
  });

  // CSS theming state
  const [darkModeDisabled, setDarkModeDisabled] = useState(false);
  const [rawCss, setRawCss] = useState('');
  const [cssVars, setCssVars] = useState<Record<string, string>>({
    background: '',
    foreground: '',
    muted: '',
    mutedForeground: '',
    popover: '',
    popoverForeground: '',
    card: '',
    cardBorder: '',
    cardBorderTint: '',
    cardForeground: '',
    fieldCard: '',
    fieldCardBorder: '',
    fieldCardForeground: '',
    widget: '',
    widgetForeground: '',
    border: '',
    input: '',
    primary: '',
    primaryForeground: '',
    secondary: '',
    secondaryForeground: '',
    accent: '',
    accentForeground: '',
    destructive: '',
    destructiveForeground: '',
    ring: '',
    radius: '',
    warning: '',
  });

  const [isResolvingToken, setIsResolvingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoLaunched = useRef(false);

  /**
   * If the token starts with "api_", exchange it for a presign token
   * via the embedding presign endpoint. Otherwise return as-is.
   */
  const resolveToken = async (inputToken: string): Promise<string> => {
    if (!inputToken.startsWith('api_')) {
      return inputToken;
    }

    const response = await fetch('/api/v2/embedding/create-presign-token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${inputToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to exchange API token (${response.status}): ${text}`);
    }

    const data = await response.json();
    const presignToken = data?.token;

    if (!presignToken || typeof presignToken !== 'string') {
      throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
    }

    return presignToken;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const timestamp = new Date().toISOString().slice(11, 19);
      setMessages((prev) => [...prev, `[${timestamp}] ${JSON.stringify(event.data, null, 2)}`]);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-launch on mount if token is present in query params
  useEffect(() => {
    if (hasAutoLaunched.current) {
      return;
    }

    const initialToken = searchParams.get('token');

    if (initialToken) {
      hasAutoLaunched.current = true;
      void launchEmbed(initialToken);
    }
  }, []);

  const updateQueryParams = (params: {
    token: string;
    externalId: string;
    mode: string;
    envelopeId: string;
    envelopeType: string;
  }) => {
    const newParams = new URLSearchParams();

    if (params.token) {
      newParams.set('token', params.token);
    }

    if (params.externalId) {
      newParams.set('externalId', params.externalId);
    }

    if (params.mode && params.mode !== 'create') {
      newParams.set('mode', params.mode);
    }

    if (params.envelopeId) {
      newParams.set('envelopeId', params.envelopeId);
    }

    if (params.envelopeType && params.envelopeType !== 'DOCUMENT') {
      newParams.set('envelopeType', params.envelopeType);
    }

    const qs = newParams.toString();

    void navigate(qs ? `?${qs}` : '.', { replace: true });
  };

  const launchEmbed = async (overrideToken?: string) => {
    const inputToken = overrideToken ?? token;

    if (!inputToken) {
      return;
    }

    setTokenError(null);
    setIsResolvingToken(true);

    let presignToken: string;

    try {
      presignToken = await resolveToken(inputToken);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : String(err));
      setIsResolvingToken(false);
      return;
    }

    setIsResolvingToken(false);

    // Filter out empty cssVars entries
    const filteredCssVars: Record<string, string> = {};

    for (const [key, value] of Object.entries(cssVars)) {
      if (value) {
        filteredCssVars[key] = value;
      }
    }

    const hashData = {
      externalId: externalId || undefined,
      type: mode === 'create' ? envelopeType : undefined,
      darkModeDisabled: darkModeDisabled || undefined,
      css: rawCss || undefined,
      cssVars: Object.keys(filteredCssVars).length > 0 ? filteredCssVars : undefined,
      features: {
        general: generalFeatures,
        settings: settingsFeatures,
        actions: actionsFeatures,
        envelopeItems: envelopeItemsFeatures,
        recipients: recipientsFeatures,
        fields: fieldsFeatures,
      },
    };

    const hash = btoa(encodeURIComponent(JSON.stringify(hashData)));

    const basePath =
      mode === 'create'
        ? '/embed/v2/authoring/envelope/create'
        : `/embed/v2/authoring/envelope/edit/${envelopeId}`;

    setIframeSrc(`${basePath}?token=${presignToken}#${hash}`);
    setIframeKey((prev) => prev + 1);

    updateQueryParams({ token: inputToken, externalId, mode, envelopeId, envelopeType });
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void launchEmbed();
    },
    [
      token,
      externalId,
      mode,
      envelopeId,
      envelopeType,
      generalFeatures,
      settingsFeatures,
      actionsFeatures,
      envelopeItemsFeatures,
      recipientsFeatures,
      fieldsFeatures,
      darkModeDisabled,
      rawCss,
      cssVars,
    ],
  );

  const handleClear = () => {
    setToken('');
    setExternalId('');
    setMode('create');
    setEnvelopeId('');
    setEnvelopeType('DOCUMENT');
    setIframeSrc(null);
    setMessages([]);
    setTokenError(null);
    setDarkModeDisabled(false);
    setRawCss('');
    setCssVars((prev) => {
      const cleared: Record<string, string> = {};

      for (const key of Object.keys(prev)) {
        cleared[key] = '';
      }

      return cleared;
    });
    void navigate('.', { replace: true });
  };

  const renderCheckboxGroup = <T extends Record<string, boolean>>(
    label: string,
    state: T,
    setState: React.Dispatch<React.SetStateAction<T>>,
  ) => (
    <fieldset
      style={{ border: '1px solid #ccc', padding: '8px', marginBottom: '8px', borderRadius: '4px' }}
    >
      <legend style={{ fontWeight: 'bold', fontSize: '13px' }}>{label}</legend>
      {Object.entries(state).map(([key, value]) => (
        <label key={key} style={{ display: 'block', fontSize: '12px', marginBottom: '2px' }}>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setState((prev) => ({ ...prev, [key]: e.target.checked }))}
            style={{ marginRight: '4px' }}
          />
          {key}
        </label>
      ))}
    </fieldset>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'monospace' }}>
      {/* Left panel: controls */}
      <div
        style={{
          width: '320px',
          padding: '12px',
          borderRight: '1px solid #ccc',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '16px' }}>Embed Test</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>
              API or Embedded Token (Required)
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ width: '100%', padding: '4px', fontSize: '12px' }}
              placeholder="api_... or presign token"
              required
            />
            {tokenError && (
              <div style={{ color: 'red', fontSize: '11px', marginTop: '4px' }}>{tokenError}</div>
            )}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>
              External ID (optional)
            </label>
            <input
              type="text"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              style={{ width: '100%', padding: '4px', fontSize: '12px' }}
              placeholder="your-correlation-id"
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'create' | 'edit')}
              style={{ width: '100%', padding: '4px', fontSize: '12px' }}
            >
              <option value="create">Create</option>
              <option value="edit">Edit</option>
            </select>
          </div>

          {mode === 'create' && (
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>
                Envelope Type
              </label>
              <select
                value={envelopeType}
                onChange={(e) => setEnvelopeType(e.target.value as 'DOCUMENT' | 'TEMPLATE')}
                style={{ width: '100%', padding: '4px', fontSize: '12px' }}
              >
                <option value="DOCUMENT">Document</option>
                <option value="TEMPLATE">Template</option>
              </select>
            </div>
          )}

          {mode === 'edit' && (
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>
                Envelope ID
              </label>
              <input
                type="text"
                value={envelopeId}
                onChange={(e) => setEnvelopeId(e.target.value)}
                style={{ width: '100%', padding: '4px', fontSize: '12px' }}
                placeholder="envelope_..."
                required
              />
            </div>
          )}

          <h3 style={{ fontSize: '14px', margin: '12px 0 4px' }}>Feature Flags</h3>

          {renderCheckboxGroup('General', generalFeatures, setGeneralFeatures)}
          {renderCheckboxGroup('Settings', settingsFeatures, setSettingsFeatures)}
          {renderCheckboxGroup('Actions', actionsFeatures, setActionsFeatures)}
          {renderCheckboxGroup('Envelope Items', envelopeItemsFeatures, setEnvelopeItemsFeatures)}
          {renderCheckboxGroup('Recipients', recipientsFeatures, setRecipientsFeatures)}
          {renderCheckboxGroup('Fields', fieldsFeatures, setFieldsFeatures)}

          <h3 style={{ fontSize: '14px', margin: '12px 0 4px' }}>CSS Theming</h3>

          <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>
            <input
              type="checkbox"
              checked={darkModeDisabled}
              onChange={(e) => setDarkModeDisabled(e.target.checked)}
              style={{ marginRight: '4px' }}
            />
            darkModeDisabled
          </label>

          <fieldset
            style={{
              border: '1px solid #ccc',
              padding: '8px',
              marginBottom: '8px',
              borderRadius: '4px',
            }}
          >
            <legend style={{ fontWeight: 'bold', fontSize: '13px' }}>CSS Variables</legend>
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {Object.entries(cssVars).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '2px',
                  }}
                >
                  <label style={{ fontSize: '11px', width: '140px', flexShrink: 0 }}>{key}</label>
                  {key !== 'radius' && (
                    <input
                      type="color"
                      value={value || '#000000'}
                      onChange={(e) => setCssVars((prev) => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: '24px', height: '20px', padding: 0, border: 'none' }}
                    />
                  )}
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setCssVars((prev) => ({ ...prev, [key]: e.target.value }))}
                    style={{ flex: 1, padding: '2px 4px', fontSize: '11px' }}
                    placeholder={key === 'radius' ? '0.5rem' : '#hex or color'}
                  />
                  {value && (
                    <button
                      type="button"
                      onClick={() => setCssVars((prev) => ({ ...prev, [key]: '' }))}
                      style={{
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: '0 4px',
                        lineHeight: '18px',
                      }}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset
            style={{
              border: '1px solid #ccc',
              padding: '8px',
              marginBottom: '8px',
              borderRadius: '4px',
            }}
          >
            <legend style={{ fontWeight: 'bold', fontSize: '13px' }}>Raw CSS</legend>
            <textarea
              value={rawCss}
              onChange={(e) => setRawCss(e.target.value)}
              style={{
                width: '100%',
                height: '80px',
                padding: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
              placeholder=".my-class { color: red; }"
            />
          </fieldset>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={isResolvingToken}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: isResolvingToken ? 'not-allowed' : 'pointer',
                opacity: isResolvingToken ? 0.6 : 1,
              }}
            >
              {isResolvingToken ? 'Resolving Token...' : 'Launch Embed'}
            </button>

            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </form>

        {/* Message log */}
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '14px', margin: '0 0 4px' }}>
            PostMessage Log
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                style={{ marginLeft: '8px', fontSize: '10px', cursor: 'pointer' }}
              >
                clear
              </button>
            )}
          </h3>
          <div
            style={{
              height: '200px',
              overflowY: 'auto',
              border: '1px solid #ccc',
              padding: '4px',
              fontSize: '11px',
              backgroundColor: '#f9f9f9',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {messages.length === 0 && (
              <span style={{ color: '#999' }}>Waiting for messages...</span>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ borderBottom: '1px solid #eee', padding: '2px 0' }}>
                {msg}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Right panel: iframe */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {iframeSrc ? (
          <iframe
            key={iframeKey}
            src={iframeSrc}
            style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
            title="Embedded Authoring"
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '14px',
            }}
          >
            Enter a token and click "Launch Embed" to start
          </div>
        )}
      </div>
    </div>
  );
}
