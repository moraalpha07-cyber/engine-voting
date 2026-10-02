async function findActive() {
  const res = await fetch('https://api.github.com/repos/moraalpha07-cyber/engine-voting/actions/runs?status=in_progress', {
    headers: { 'User-Agent': 'node-fetch' }
  });
  const data = await res.json();
  console.log('In Progress Runs:', data.total_count);
  (data.workflow_runs || []).forEach(r => {
    console.log(`ID: ${r.id} | Name: ${r.name} | Created: ${r.created_at} | URL: ${r.html_url}`);
  });
}
findActive();
