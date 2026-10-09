import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path
from . import core, metrics

def emit(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))

def mock_call(body, timeout):
    answers = {qid: {'type': 'noul', 'noul': .99 if 'IMPORTANT_BUSINESS_CONTEXT' in next(b['text'] for b in body['state']['blocks'] if b['id'] == qid) else .01} for qid in body['questions']}
    return {'model': core.MODEL, 'answers': answers, 'usage': {'input_tokens': 0, 'output_tokens': 0}}

def log_bench(outdir, live=False):
    outdir.mkdir(parents=True, exist_ok=True)
    rows = []
    for index, name in enumerate(('build', 'test', 'migration', 'deploy', 'dependency')):
        lines = ['progress item ' + str(i) + '\n' for i in range(320)]
        critical = f'ERROR {name}: expected contract {index}, got invalid\n'
        context = f'IMPORTANT_BUSINESS_CONTEXT tenant_region_{index} explains this {name}\n'
        lines[141], lines[47] = critical, context
        text = ''.join(lines)
        core.private_write(outdir / (name + '-raw.log'), text)
        for arm in ('baseline', 'local', 'jev' if live else 'mock_jev'):
            start = time.monotonic()
            if arm == 'baseline':
                output, meta = text, {'reason': 'baseline', 'jev_cost_usd_estimate': 0}
            else:
                output, meta = core.prune(text, 'rules' if arm == 'local' else 'jev',
                                         goal='Diagnose ' + name + ' and retain relevant business context',
                                         caller=core.request if live else mock_call)
            # Fake usage is explicitly not a real API cost measurement.
            if arm == 'mock_jev':
                meta['jev_cost_usd_estimate'] = None
            evidence = [critical.strip(), context.strip()]
            rows.append(dict(meta, record_type='log_proxy', fixture=name, arm=arm,
                             evidence_retention=sum(x in output for x in evidence)/len(evidence),
                             error_retention=critical.strip() in output,
                             character_reduction=1-len(output)/len(text),
                             measured_latency_ms=(time.monotonic()-start)*1000))
            core.private_write(outdir / (name + '-' + arm + '.log'), output)
    core.private_write(outdir / 'log-proxy.json', json.dumps(rows, ensure_ascii=False, indent=2))
    table = ['# Log proxy comparison', '', '**Synthetic fixtures only. No agent task success or downstream dollar savings are measured.**', '',
             '| Fixture | Arm | Char reduction | Evidence retained | Error retained | Latency ms |', '|---|---|---:|---:|---|---:|']
    for r in rows:
        table.append(f"| {r['fixture']} | {r['arm']} | {r['character_reduction']:.1%} | {r['evidence_retention']:.0%} | {r['error_retention']} | {r['measured_latency_ms']:.3f} |")
    core.private_write(outdir / 'log-proxy.md', '\n'.join(table) + '\n')
    emit({'report': str(outdir / 'log-proxy.md'), 'mode': 'live' if live else 'mock',
          'live_valid_decisions': sum(r.get('reason') == 'ok' and r['arm'] == 'jev' for r in rows)})
    return 0 if not live or all(r.get('reason') == 'ok' for r in rows if r['arm'] == 'jev') else 3

def main():
    p = argparse.ArgumentParser(description='Jev agent kit CLI: doctor, live smoke, mock demo, status/readback and paired evaluation')
    p.add_argument('--env-file', help='Explicit local dotenv path; key never printed')
    sub = p.add_subparsers(dest='cmd', required=True)
    sub.add_parser('doctor')
    sub.add_parser('smoke')
    b = sub.add_parser('bench-logs'); b.add_argument('--outdir', default='results/logs'); b.add_argument('--live', action='store_true')
    s = sub.add_parser('status'); s.add_argument('--project', default='.')
    r = sub.add_parser('readback'); r.add_argument('artifact_id'); r.add_argument('--project', default='.')
    c = sub.add_parser('check-config'); c.add_argument('--project', default='.')
    e = sub.add_parser('report'); e.add_argument('--manifest', required=True); e.add_argument('--records', required=True); e.add_argument('--outdir', default='results/agent')
    args = p.parse_args()
    try:
        core.load_env(args.env_file or os.environ.get('JEV_ENV_FILE'))
        if args.cmd == 'doctor':
            emit({'python': sys.version.split()[0], 'claude_cli_available': bool(shutil.which('claude')),
                  'jev_key_present': bool(os.environ.get('TYPESAFE_API_KEY')), 'kit_version': core.VERSION,
                  'endpoint': core.ENDPOINT, 'model': core.MODEL,
                  'note': 'Key presence is not authentication validation. This reports the Python side only; the native Mod ships in hooks/register.ts (use /jev doctor in a session).'})
        elif args.cmd == 'smoke':
            obj = core.request({'model': core.MODEL, 'state': 'A unit test failed.', 'questions': {
                'failed': {'type': 'noul', 'instructions': 'Does the state say that a unit test failed?'}}})
            ans = core.validate_nouls(obj, ['failed'])
            emit({'status': 'api_validated', 'answers': ans, 'model': obj['model'], 'usage': obj['usage']})
        elif args.cmd == 'bench-logs':
            return log_bench(Path(args.outdir), args.live)
        elif args.cmd == 'check-config':
            emit(core.config(args.project))
        elif args.cmd == 'readback':
            sys.stdout.write(core.readback(core.root_for(args.project), args.artifact_id))
        elif args.cmd == 'status':
            folder = core.root_for(args.project) / 'decisions'
            rows = [json.loads(f.read_text()) for f in sorted(folder.glob('*.json'))] if folder.exists() else []
            emit({'project_records': len(rows), 'recent': rows[-10:], 'note': 'Hook decisions are not agent success measurements.'})
        elif args.cmd == 'report':
            manifest = json.loads(Path(args.manifest).read_text())
            rows = [json.loads(line) for line in Path(args.records).read_text().splitlines() if line.strip()]
            obj = metrics.report(manifest, rows)
            directory = Path(args.outdir); directory.mkdir(parents=True, exist_ok=True)
            core.private_write(directory / 'agent-report.json', json.dumps(obj, indent=2, ensure_ascii=False))
            core.private_write(directory / 'agent-report.md', metrics.markdown(obj))
            emit({'report': str(directory / 'agent-report.md'), 'status': obj['status']})
            return 0 if obj['status'] == 'COMPLETE' else 4
    except core.JevError as exc:
        emit({'status': 'no_verdict', 'reason': str(exc)}); return 3
    except Exception:
        emit({'status': 'error', 'reason': 'invalid_input_or_local_io'}); return 2
    return 0
