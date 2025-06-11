export function getWorkflowWebhookUrl() {
  const url = new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000',
  );
  url.pathname = '/api/workflow';
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    url.searchParams.set(
      'x-vercel-protection-bypass',
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    );
  }

  return url;
}
