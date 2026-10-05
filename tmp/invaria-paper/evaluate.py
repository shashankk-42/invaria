import json,time,statistics,platform,hashlib
from pathlib import Path
from collections import Counter
from invaria.engine import analyze
from invaria.ingestion import inventory,FIXTURES
cases=[]
for folder in sorted(FIXTURES.iterdir()):
 files=inventory(folder)[0]; analyze(files); times=[]
 for _ in range(30):
  start=time.perf_counter();r=analyze(files);times.append((time.perf_counter()-start)*1000)
 cases.append({'case':folder.name,'expected':0 if folder.name.endswith('fixed') else 1,'actual':len(r['findings']),'rules':[f.rule_id for f in r['findings']],'median_ms':statistics.median(times),'p95_ms':sorted(times)[28],'min_ms':min(times),'max_ms':max(times),'coverage':r['coverage'],'repetitions':30})
x=json.load(open('artifacts/taskforge-final-report.json'))
out={'evaluation_date':'2026-10-03','python':platform.python_version(),'platform':platform.platform(),'cases':cases,'archive':{'file':'artifacts/taskforge-final-report.json','sha256':hashlib.sha256(Path('artifacts/taskforge-final-report.json').read_bytes()).hexdigest(),'scan_date':x['created_at'],'commit':x['commit'],'coverage':x['coverage'],'duration_seconds':x['duration_seconds'],'categories':dict(Counter(f['category'] for f in x['findings'])),'rules':dict(Counter(f['rule_id'] for f in x['findings'])),'summary':x['summary'],'model_status':x['model_status'],'retrieval_modes':x['retrieval_modes'],'llm_status':dict(Counter(f['status'] for f in x['llm_runs']))}}
Path('tmp/invaria-paper/results.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
