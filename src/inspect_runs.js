async function inspectRuns() {
  try {
    const res = await fetch('https://api.github.com/repos/moraalpha07-cyber/engine-voting/actions/runs?per_page=5', {
      headers: { 'User-Agent': 'node-fetch' }
    });
    const data = await res.json();
    for (const r of (data.workflow_runs || [])) {
      console.log(`\nRun ID: ${r.id} | Name: ${r.name}`);
      console.log(`Status: ${r.status} | Conclusion: ${r.conclusion || 'RUNNING'}`);
      console.log(`Created: ${r.created_at} | Updated: ${r.updated_at}`);
      
      const jobsRes = await fetch(r.jobs_url, { headers: { 'User-Agent': 'node-fetch' } });
      const jobsData = await jobsRes.json();
      if (jobsData.jobs && jobsData.jobs.length > 0) {
        jobsData.jobs.forEach(j => {
          console.log(`  Job: ${j.name} [${j.status} / ${j.conclusion || 'RUNNING'}]`);
          if (j.steps) {
            j.steps.forEach(s => {
              console.log(`    Step: ${s.name} [${s.status} / ${s.conclusion || 'PENDING'}]`);
            });
          }
        });
      } else {
        console.log('  No jobs queued yet.');
      }
    }
  } catch (e) {
    console.error(e);
  }
}

inspectRuns();
