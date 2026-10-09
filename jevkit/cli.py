import argparse
import json
import os
import shutil
import shlex
import subprocess
import sys
import time
from pathlib import Path
from . import core, metrics

def emit(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))

def install(project, backend, mode):
    project = Path(project).resolve()
    if not project.is_dir():
        raise ValueError('project_missing')
    folder = project / '.claude'; folder.mkdir(exist_ok=True)
    path = folder / 'settings.json'
    settings = json.loads(path.read_text()) if path.exists() else {}
    if not isinstance(settings, dict) or not isinstance(settings.get('hooks', {}), dict):
        raise ValueError('invalid_existing_settings')
    script = str(Path(__file__).resolve().parents[1] / 'jev.py')
    command = subprocess.list2cmdline([sys.executable, script, 'hook']) if os.name == 'nt' else ' '.join(shlex.quote(x) for x in [sys.executable, script, 'hook'])
    for event in ('PostToolUse', 'PostToolUseFailure'):
        groups = settings.setdefault('hooks', {}).setdefault(event, [])
        if not isinstance(groups, list):
            raise ValueError('invalid_existing_hooks')
        if not any(h.get('command') == command for g in groups for h in g.get('hooks', [])):
            groups.append({'matcher':'Bash','hooks':[{'type':'command','command':command,'timeout':15}]})
    if path.exists():
        core.private_write(folder / ('settings.backup-' + str(time.time_ns()) + '.json'), path.read_text())
    temp = folder / ('settings.tmp-' + str(time.time_ns()) + '.json')
    core.private_write(temp, json.dumps(settings, indent=2)); os.replace(temp, path)
    cfgpath = folder / 'jev-agent-kit.json'
    if not cfgpath.exists():
        core.private_write(cfgpath, json.dumps({'schemaVersion':1,'enabled':True,'mode':mode,'backend':backend}, indent=2))
    emit({'status':'classic_hooks_installed','settings':str(path),'config':str(cfgpath),
          'note':'Existing project config preserved. Reload/restart Claude. Do not also load the plugin adapter.'})

def goal_file(project):
    path = Path(project) / '.claude' / 'jev-goal.txt'
    return core.redact(path.read_text(encoding='utf-8')[:1200]) if path.exists() else 'Diagnose the current test or build failure'

def hook():
    # Protocol stdout must contain only a valid hook JSON response, or nothing.
    try:
        raw = sys.stdin.buffer.read(core.MAX_BYTES + 1)
        if len(raw) > core.MAX_BYTES:
            return
        event = json.loads(raw)
        if event.get('tool_name') != 'Bash':
            return
        project = event.get('cwd', os.getcwd())
        cfg = core.config(project)
        if not cfg['enabled']:
            return
        root = core.root_for(project)
        core.cleanup(root, cfg['retentionDays'])
        if core.mod_active(event.get('session_id')):
            return  # the native Mod owns this session; never process the same event twice
        name = event.get('hook_event_name')
        response = event.get('tool_response')
        if name == 'PostToolUseFailure':
            text = str(event.get('error', ''))
        elif isinstance(response, dict) and isinstance(response.get('stdout'), str):
            text = response['stdout']
        else:
            core.record(root, {'feature': 'compatibility', 'reason': 'unknown_tool_shape'})
            return
        # Repo fingerprint is diagnostic only; errors preserve normal execution.
        state = 'unknown'
        try:
            head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=project, capture_output=True, timeout=1)
            diff = subprocess.run(['git', 'diff', 'HEAD', '--'], cwd=project, capture_output=True, timeout=1)
            if head.returncode == 0 and diff.returncode == 0:  # not a repo / no commits: state stays unknown
                state = core.digest([head.stdout.hex(), diff.stdout.hex()])
        except Exception:
            pass
        _, count = core.repeated(root, event.get('session_id', 'unknown'),
                                 event.get('tool_input', {}).get('command', ''), text, state)
        core.record(root, {'feature': 'loop', 'repeated_count': count, 'action': 'observe',
                           'repo_state_known': state != 'unknown', 'mode': cfg['mode']})
        if name == 'PostToolUseFailure' or len(text) < cfg['minimumChars']:
            return
        original_id = core.artifact(root, text)
        output, meta = core.prune(text, cfg['backend'], goal_file(project), cfg['timeoutSeconds'], cfg['keepThreshold'])
        if output != text:
            output += '\n[Jev agent kit: full original available via readback ' + original_id + ']\n'
        fields_ok = all(k in response for k in ('stderr', 'interrupted', 'isImage'))
        # Never change failed/interrupted/image tool results or erase stderr.
        can_rewrite = (cfg['mode'] == 'assist' and output != text and fields_ok
                       and not response.get('interrupted') and not response.get('isImage'))
        if cfg['mode'] == 'assist' and output != text and not fields_ok:
            core.record(root, {'feature': 'compatibility', 'reason': 'missing_tool_fields'})
        core.record(root, dict(meta, mode=cfg['mode'], artifact_id=original_id,
                               delivered_chars=len(output) if can_rewrite else len(text)))
        if can_rewrite:
            emit({'hookSpecificOutput': {'hookEventName': 'PostToolUse',
                  'updatedToolOutput': dict(response, stdout=output)}})
    except Exception:
        # This is cost optimization, never a security gate; fail to original.
        return

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
    p = argparse.ArgumentParser(description='Jev agent kit: hook, live smoke, mock demo and paired evaluation')
    p.add_argument('--env-file', help='Explicit local dotenv path; key never printed')
    sub = p.add_subparsers(dest='cmd', required=True)
    sub.add_parser('doctor')
    sub.add_parser('smoke')
    sub.add_parser('hook')
    i = sub.add_parser('install'); i.add_argument('--project', required=True); i.add_argument('--backend', choices=['rules','jev'], default='rules'); i.add_argument('--mode', choices=['observe','assist'], default='observe')
    b = sub.add_parser('bench-logs'); b.add_argument('--outdir', default='results/logs'); b.add_argument('--live', action='store_true')
    s = sub.add_parser('status'); s.add_argument('--project', default='.')
    r = sub.add_parser('readback'); r.add_argument('artifact_id'); r.add_argument('--project', default='.')
    c = sub.add_parser('check-config'); c.add_argument('--project', default='.')
    e = sub.add_parser('report'); e.add_argument('--manifest', required=True); e.add_argument('--records', required=True); e.add_argument('--outdir', default='results/agent')
    args = p.parse_args()
    try:
        core.load_env(args.env_file or os.environ.get('JEV_ENV_FILE'))
        if args.cmd == 'hook':
            hook(); return 0
        if args.cmd == 'install':
            install(args.project, args.backend, args.mode); return 0
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
        if args.cmd != 'hook':
            emit({'status': 'error', 'reason': 'invalid_input_or_local_io'}); return 2
    return 0
