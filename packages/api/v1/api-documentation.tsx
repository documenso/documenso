'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

import { OpenAPIV1 } from '@documenso/api/v1/openapi';

// Custom CSS for the Swagger UI
// eslint-disable-next-line prettier/prettier
import './api-documentation.css';

export const OpenApiDocsPage = () => {
  return <SwaggerUI spec={OpenAPIV1} displayOperationId={true} />;
};

export default OpenApiDocsPage;
