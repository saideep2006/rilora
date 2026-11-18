import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
const config = defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', '.next-*/**', 'node_modules/**']), { rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/set-state-in-effect': 'off' } }]);
export default config;
