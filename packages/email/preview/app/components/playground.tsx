import { SUPPORTED_LANGUAGE_CODES } from '@documenso/lib/constants/locales';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import type { FieldConfig } from '../lib/templates';
import { templates } from '../lib/templates';
import { viewports } from '../lib/viewports';
import { PropFields } from './prop-fields';

type Theme = 'light' | 'dark';

const GROUP_ORDER = ['Documents', 'Recipients', 'Organisations', 'Teams', 'Account', 'Admin'] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  'pt-BR': 'Portuguese (Brazil)',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};

const DEFAULT_COLORS = {
  primary: '#a2e771',
  primaryForeground: '#162c07',
  background: '#ffffff',
  foreground: '#0f172a',
};

type PlaygroundProps = {
  slug: string;
  fields: Record<string, FieldConfig>;
  defaultProps: Record<string, unknown>;
};

export const EmailPlayground = ({ slug, fields, defaultProps }: PlaygroundProps) => {
  const navigate = useNavigate();

  const [props, setProps] = useState(defaultProps);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);

  const [theme, setTheme] = useState<Theme>('light');
  const [viewportIndex, setViewportIndex] = useState(2);
  const [lang, setLang] = useState('en');

  const [brandingEnabled, setBrandingEnabled] = useState(false);
  const [colors, setColors] = useState(DEFAULT_COLORS);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const groupedTemplates = useMemo(() => {
    const entries = Object.entries(templates);

    return GROUP_ORDER.map((group) => ({
      group,
      entries: entries.filter(([, def]) => def.group === group),
    })).filter((section) => section.entries.length > 0);
  }, []);

  const fetchHtml = useCallback(
    async (currentProps: Record<string, unknown>, currentLang: string, brandColors: typeof colors | null) => {
      setLoading(true);

      try {
        const response = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            props: currentProps,
            lang: currentLang,
            colors: brandColors,
            assetBaseUrl: window.location.origin,
          }),
        });

        if (response.ok) {
          setHtml(await response.text());
        }
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  // Reset props when navigating to a different template.
  useEffect(() => {
    setProps(defaultProps);
  }, [defaultProps]);

  // Re-render on any input change (debounced).
  useEffect(() => {
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void fetchHtml(props, lang, brandingEnabled ? colors : null);
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [props, lang, brandingEnabled, colors, fetchHtml]);

  const handlePropChange = (key: string, value: unknown) => {
    setProps((prev) => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: keyof typeof colors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  // Force dark mode inside the iframe by neutralising the prefers-color-scheme
  // media query (color-scheme alone doesn't trigger it inside an iframe).
  const displayHtml = theme === 'dark' && html ? html.replaceAll(/prefers-color-scheme:\s*dark/g, 'min-width:0') : html;

  const viewport = viewports[viewportIndex];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-100 font-sans text-neutral-900">
      {/* Sidebar */}
      <aside className="flex h-full w-60 flex-shrink-0 flex-col overflow-y-auto border-neutral-200 border-r bg-white">
        <div className="border-neutral-200 border-b px-4 py-3">
          <h1 className="font-semibold text-sm">Email Preview</h1>
          <p className="text-neutral-500 text-xs">{Object.keys(templates).length} templates</p>
        </div>

        <nav className="flex-1 px-2 py-2">
          {groupedTemplates.map((section) => (
            <div key={section.group} className="mb-3">
              <div className="px-2 py-1 font-medium text-neutral-400 text-xs uppercase tracking-wide">
                {section.group}
              </div>

              {section.entries.map(([id, def]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(`/${id}`)}
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    slug === id ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {def.name}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Props panel */}
      <section className="flex h-full w-72 flex-shrink-0 flex-col overflow-y-auto border-neutral-200 border-r bg-white px-4 py-3">
        <h2 className="mb-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">Props</h2>
        <PropFields fields={fields} values={props} onChange={handlePropChange} />
      </section>

      {/* Main */}
      <main className="flex h-full flex-1 flex-col overflow-hidden">
        <Toolbar
          theme={theme}
          setTheme={setTheme}
          viewportIndex={viewportIndex}
          setViewportIndex={setViewportIndex}
          lang={lang}
          setLang={setLang}
          brandingEnabled={brandingEnabled}
          setBrandingEnabled={setBrandingEnabled}
          colors={colors}
          onColorChange={handleColorChange}
          loading={loading}
        />

        <div
          className={`flex flex-1 items-start justify-center overflow-auto p-6 ${
            theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'
          }`}
        >
          <div
            className="flex-shrink-0 overflow-hidden rounded-lg bg-white shadow-lg"
            style={{ width: viewport.width }}
          >
            <iframe
              title={`${viewport.name} ${theme}`}
              srcDoc={displayHtml}
              className="h-[calc(100vh-8rem)] w-full border-0"
              style={{ colorScheme: theme }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

type ToolbarProps = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  viewportIndex: number;
  setViewportIndex: (index: number) => void;
  lang: string;
  setLang: (lang: string) => void;
  brandingEnabled: boolean;
  setBrandingEnabled: (enabled: boolean) => void;
  colors: typeof DEFAULT_COLORS;
  onColorChange: (key: keyof typeof DEFAULT_COLORS, value: string) => void;
  loading: boolean;
};

const Toolbar = (props: ToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-4 border-neutral-200 border-b bg-white px-4 py-2">
      <SegmentedControl
        label="Theme"
        value={props.theme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(value) => props.setTheme(value as Theme)}
      />

      <SegmentedControl
        label="Viewport"
        value={String(props.viewportIndex)}
        options={viewports.map((viewport, index) => ({ value: String(index), label: viewport.name }))}
        onChange={(value) => props.setViewportIndex(Number(value))}
      />

      <label className="flex items-center gap-1.5 text-neutral-600 text-xs">
        <span className="font-medium">Language</span>
        <select
          value={props.lang}
          onChange={(event) => props.setLang(event.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-xs"
        >
          {SUPPORTED_LANGUAGE_CODES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_LABELS[code] ?? code}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-neutral-600 text-xs">
        <input
          type="checkbox"
          checked={props.brandingEnabled}
          onChange={(event) => props.setBrandingEnabled(event.target.checked)}
        />
        <span className="font-medium">Brand colours</span>
      </label>

      {props.brandingEnabled && (
        <div className="flex items-center gap-3">
          <ColorInput
            label="Primary"
            value={props.colors.primary}
            onChange={(value) => props.onColorChange('primary', value)}
          />
          <ColorInput
            label="On primary"
            value={props.colors.primaryForeground}
            onChange={(value) => props.onColorChange('primaryForeground', value)}
          />
          <ColorInput
            label="Background"
            value={props.colors.background}
            onChange={(value) => props.onColorChange('background', value)}
          />
          <ColorInput
            label="Text"
            value={props.colors.foreground}
            onChange={(value) => props.onColorChange('foreground', value)}
          />
        </div>
      )}

      <span className="ml-auto text-neutral-400 text-xs">{props.loading ? 'Rendering…' : ''}</span>
    </div>
  );
};

type SegmentedControlProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

const SegmentedControl = (props: SegmentedControlProps) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium text-neutral-600 text-xs">{props.label}</span>
      <div className="flex overflow-hidden rounded-md border border-neutral-300">
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            className={`px-2.5 py-1 text-xs transition-colors ${
              props.value === option.value
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

type ColorInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const ColorInput = (props: ColorInputProps) => {
  return (
    <label className="flex items-center gap-1 text-neutral-600 text-xs">
      <span>{props.label}</span>
      <input
        type="color"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-6 w-6 cursor-pointer rounded border border-neutral-300 bg-white p-0"
      />
    </label>
  );
};
