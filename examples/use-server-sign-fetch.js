const SERVER = 'http://localhost:8080';
const TARGET = process.argv[2] || 'https://www.tiktok.com/api/post/item_list/?aid=1988&app_name=tiktok_web&device_platform=web_pc&secUid=MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr&cursor=0&count=6';

async function main(){
  console.log('Requesting signature for target:', TARGET.substring(0,120)+'...');
  const resp = await fetch(`${SERVER}/signature`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({url: TARGET})
  });
  const j = await resp.json();
  if (j.status !== 'ok') throw new Error('signature failed: '+JSON.stringify(j));
  console.log('Signed URL:', j.data.signed_url.substring(0,200)+'...');

  console.log('Requesting /fetch through server to use browser cookies...');
  const f = await fetch(`${SERVER}/fetch`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ url: j.data.signed_url })
  });
  const fj = await f.json();
  console.log('Fetch result status:', fj.status);
  if (fj.status === 'ok'){
    console.log('HTTP status:', fj.httpStatus);
    console.log('Data keys:', fj.data ? Object.keys(fj.data).slice(0,10) : null);
  } else {
    console.error('Fetch error:', fj);
  }
}

main().catch(e=>{console.error(e); process.exit(1);});
