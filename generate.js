import { generateApi } from 'swagger-typescript-api';
import * as path from 'node:path';
import yaml from 'yaml';

// download the spec
const spec = await fetch(
  process.env.OPENAPI_SPEC_URL || 'https://router.mcprouter.app/openapi.yaml',
);
const specJson = await spec.text();
const parsedSpec = yaml.parse(specJson);

/**
 * Generate API client from OpenAPI spec
 */
generateApi({
  fileName: 'client.ts',
  output: path.resolve(process.cwd(), './lib/api/mcp-router'),
  spec: parsedSpec,
  httpClientType: 'fetch',
  extractEnums: true,
}).then(() => {
  process.exit(0);
});
