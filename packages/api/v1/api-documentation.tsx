'use client';

import { useEffect } from 'react';

import { useTheme } from 'next-themes';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

import { OpenAPIV1 } from '@documenso/api/v1/openapi';

export const OpenApiDocsPage = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const body = document.body;

    if (resolvedTheme === 'dark') {
      body.classList.add('swagger-dark-theme');
    } else {
      body.classList.remove('swagger-dark-theme');
    }

    return () => {
      body.classList.remove('swagger-dark-theme');
    };
  }, [resolvedTheme]);

  return <SwaggerUI spec={OpenAPIV1} displayOperationId={true} />;
};

export default OpenApiDocsPage;
