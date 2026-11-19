import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [...nextVitals, ...nextTs, { ignores: ['.next/**', '.next-preview/**', 'next-env.d.ts', 'design-preview/**'] }];
