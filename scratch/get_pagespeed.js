const https = require('https');

const url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://wargapakem.vercel.app/&strategy=mobile';

console.log('Fetching PageSpeed Insights data for Mobile...');

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.error) {
        console.error('API Error:', json.error.message);
        return;
      }
      
      const lighthouse = json.lighthouseResult;
      const categories = lighthouse.categories;
      
      console.log('\n--- SCORES ---');
      console.log(`Performance:    ${Math.round(categories.performance.score * 100)}`);
      console.log(`Accessibility:  ${Math.round(categories.accessibility.score * 100)}`);
      console.log(`Best Practices: ${Math.round(categories['best-practices'].score * 100)}`);
      console.log(`SEO:            ${Math.round(categories.seo.score * 100)}`);
      
      console.log('\n--- METRICS ---');
      const audits = lighthouse.audits;
      console.log(`First Contentful Paint (FCP): ${audits['first-contentful-paint'].displayValue}`);
      console.log(`Largest Contentful Paint (LCP): ${audits['largest-contentful-paint'].displayValue}`);
      console.log(`Total Blocking Time (TBT):      ${audits['total-blocking-time'].displayValue}`);
      console.log(`Cumulative Layout Shift (CLS):   ${audits['cumulative-layout-shift'].displayValue}`);
      console.log(`Speed Index:                     ${audits['speed-index'].displayValue}`);
      
      console.log('\n--- OPPORTUNITIES / DIAGNOSTICS ---');
      const opportunities = Object.values(audits)
        .filter(audit => audit.details && audit.details.type === 'opportunity' && audit.details.overallSavingsMs > 0)
        .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs);
        
      opportunities.slice(0, 5).forEach(op => {
        console.log(`- [${op.title}]: Saves ~${Math.round(op.details.overallSavingsMs)}ms (${op.description.replace(/\[Learn more\].*/g, '')})`);
      });
      
      console.log('\n--- DIAGNOSTICS ALERTS ---');
      const diagnostics = ['render-blocking-resources', 'unused-javascript', 'modern-image-formats', 'uses-optimized-images', 'dom-size'];
      diagnostics.forEach(key => {
        const audit = audits[key];
        if (audit && audit.score < 0.9) {
          console.log(`- [${audit.title}]: Score ${Math.round(audit.score * 100)}/100. ${audit.displayValue || ''}`);
        }
      });
      
    } catch (e) {
      console.error('Error parsing response:', e);
    }
  });
}).on('error', (err) => {
  console.error('HTTP Request Error:', err.message);
});
