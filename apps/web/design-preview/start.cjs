// Starts a fake API with sample data plus the web app pointed at it, with the login screen
// skipped, so every screen can be reviewed in light and dark without a database.
// Development only: the login bypass is ignored in a production build.
//
//   npm run preview -w @deeclinic/web      then open http://localhost:3100/dashboard
const { spawn } = require('node:child_process');
const path = require('node:path');

const mock = spawn(process.execPath, [path.join(__dirname, 'mock-api.cjs')], { stdio: 'inherit' });
const next = spawn('npx next dev -p 3100', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    // A separate build folder, so this can run beside the normal dev server
    NEXT_DIST_DIR: '.next-preview',
    DESIGN_PREVIEW: '1',
    NEXT_PUBLIC_API_URL: 'http://localhost:4999',
  },
});

const stop = () => {
  mock.kill();
  next.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
next.on('exit', stop);
