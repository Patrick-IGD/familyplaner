import { runGoogleLiveReadFromEnvironment } from './google-live-read.mjs';

try {
  const result = await runGoogleLiveReadFromEnvironment(process.env);
  console.log(JSON.stringify(result));
} catch {
  console.error(JSON.stringify({ status: 'failed', reason: 'google_live_read_failed' }));
  process.exitCode = 1;
}
