'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { useTheme } from 'next-themes';

export const Mermaid = ({ chart }: { chart: string }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <MermaidContent chart={chart} />;
};

const MermaidContent = ({ chart }: { chart: string }) => {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const mermaid = (await import('mermaid')).default;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
        themeCSS: 'margin: 1.5rem auto 0;',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });

      const { svg: rendered, bindFunctions } = await mermaid.render(
        id.replaceAll(':', ''),
        chart.replaceAll('\\n', '\n'),
      );

      if (!cancelled) {
        setSvg(rendered);

        if (containerRef.current) {
          bindFunctions?.(containerRef.current);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (!svg) {
    return null;
  }

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />;
};
