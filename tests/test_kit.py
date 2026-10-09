import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from jevkit import core, metrics
from jevkit.cli import install

def long_log():
    lines = ['progress ' + str(i) + '\n' for i in range(320)]
    lines[141] = 'ERROR assertion failed: expected 10 got 9\n'
    return ''.join(lines)

def rows_and_manifest():
    manifest = {'experiment_id':'x', 'task_ids':['a', 'b'], 'arms':['baseline', 'local', 'jev'],
                'baseline':'baseline', 'repeats':1}
    rows = []
    for task in manifest['task_ids']:
        for arm in manifest['arms']:
            rows.append({'record_type':'agent_task','experiment_id':'x','task_id':task,'repeat':0,'arm':arm,
                         'success':True,'first_pass':True,'cost_complete':True,'evidence_guard_passed':True,
                         'agent_cost_usd':1 if arm == 'baseline' else .7,'jev_cost_usd':.01 if arm=='jev' else 0,
                         'wall_seconds':10,'retries':0,'seed_revision':'s','verifier_revision':'v',
                         'environment_id':'e','runtime_version':'r','model_id':'m'})
    return manifest, rows

class CoreTests(unittest.TestCase):
    def test_rules_preserve_error_and_shrink(self):
        original = long_log(); output, _ = core.prune(original)
        self.assertIn('expected 10 got 9', output)
        self.assertLess(len(output), len(original))

    def test_missing_key_falls_back_exactly(self):
        with patch.dict(os.environ, {}, clear=True):
            original = long_log(); output, meta = core.prune(original, 'jev')
            self.assertEqual(output, original); self.assertEqual(meta['reason'], 'missing_key')

    def test_invalid_response_falls_back(self):
        output, meta = core.prune(long_log(), 'jev', caller=lambda *_: {'answers': {}})
        self.assertEqual(output, long_log()); self.assertFalse(meta['cost_complete'])

    def test_pinned_error_cannot_be_dropped_by_jev(self):
        def call(body, timeout):
            return {'answers':{k:{'type':'noul','noul':0} for k in body['questions']}, 'usage':{'input_tokens':123,'output_tokens':5}}
        output, meta = core.prune(long_log(), 'jev', caller=call)
        self.assertIn('ERROR assertion', output); self.assertTrue(meta['cost_complete'])

    def test_probability_nan_rejected(self):
        with self.assertRaises(core.JevError):
            core.validate_nouls({'answers':{'a':{'type':'noul','noul':float('nan')}}}, ['a'])

    def test_artifact_restore_and_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            text='中文 "quoted"\nERROR evidence\n'; aid=core.artifact(td, text)
            self.assertEqual(core.readback(td, aid), text)
            with self.assertRaises(ValueError): core.readback(td, '../passwords')

    def test_transport_fields_cannot_be_project_config(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'.claude'; path.mkdir()
            (path/'jev-agent-kit.json').write_text('{"endpoint":"https://other"}')
            with self.assertRaises(ValueError): core.config(td)

    def test_repeat_counts_and_state_changes(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(core.repeated(td, 's', 'cmd', 'error', 'v1')[1], 1)
            self.assertEqual(core.repeated(td, 's', 'cmd', 'error', 'v1')[1], 2)
            self.assertEqual(core.repeated(td, 's', 'cmd', 'error', 'v2')[1], 1)

    def test_redaction(self):
        self.assertNotIn('secretvalue', core.redact('api_key=secretvalue other data'))

    def test_env_is_data_not_code(self):
        with tempfile.TemporaryDirectory() as td, patch.dict(os.environ, {}, clear=True):
            p=Path(td)/'env'; p.write_text('UNRELATED=ignore\nTYPESAFE_API_KEY="$(not_executed)"\n')
            core.load_env(p)
            self.assertEqual(os.environ['TYPESAFE_API_KEY'], '$(not_executed)')
            self.assertNotIn('UNRELATED', os.environ)

class MetricTests(unittest.TestCase):
    def test_insufficient_and_incremental_comparison(self):
        manifest, rows=rows_and_manifest(); obj=metrics.report(manifest, rows, draws=50)
        self.assertEqual(obj['comparisons']['jev']['status'], 'INSUFFICIENT_EVIDENCE')
        self.assertIn('jev_vs_local', obj['comparisons'])
        self.assertGreater(obj['comparisons']['jev_vs_local']['cost_ratio'], 1)

    def test_missing_run_not_discarded(self):
        manifest, rows=rows_and_manifest()
        self.assertEqual(metrics.report(manifest, rows[:-1])['status'], 'INCOMPLETE')

    def test_unknown_cost_no_go(self):
        manifest, rows=rows_and_manifest(); rows[-1]['cost_complete']=False
        self.assertEqual(metrics.report(manifest, rows, draws=30)['comparisons']['jev']['status'], 'UNKNOWN_COST')

    def test_failed_runs_count_toward_cost(self):
        manifest, rows=rows_and_manifest(); rows[-1].update(success=False, first_pass=False)
        obj=metrics.report(manifest, rows, draws=30)
        self.assertAlmostEqual(obj['summaries']['jev']['cost_per_success_usd'], 1.42)

    def test_duplicate_rejected(self):
        manifest, rows=rows_and_manifest()
        with self.assertRaises(ValueError): metrics.report(manifest, rows + [rows[0]])

    def test_model_confounded_rejected(self):
        manifest, rows=rows_and_manifest(); rows[-1]['model_id']='different'
        with self.assertRaises(ValueError): metrics.report(manifest, rows)

    def test_evidence_loss_veto(self):
        manifest, rows=rows_and_manifest(); rows[-1]['evidence_guard_passed']=False
        obj=metrics.report(manifest, rows, draws=30)
        self.assertEqual(obj['comparisons']['jev']['status'], 'NO_GO_EVIDENCE_LOSS')

    def test_zero_success_undefined_not_free(self):
        manifest, rows=rows_and_manifest()
        for row in rows: row.update(success=False, first_pass=False)
        obj=metrics.report(manifest, rows, draws=30)
        self.assertIsNone(obj['summaries']['jev']['cost_per_success_usd'])

    def test_go_vs_baseline_can_still_fail_incremental_gate(self):
        manifest, rows=rows_and_manifest()
        manifest['gates']={'minimum_unique_tasks':2,'minimum_repeats':1}
        obj=metrics.report(manifest, rows, draws=100)
        self.assertEqual(obj['comparisons']['jev']['status'], 'GO')
        self.assertEqual(obj['comparisons']['jev_vs_local']['status'], 'NO_GO')

    def test_invalid_numeric_and_verifier_drift_rejected(self):
        manifest, rows=rows_and_manifest(); rows[-1]['wall_seconds']=float('inf')
        with self.assertRaises(ValueError): metrics.report(manifest, rows)
        manifest, rows=rows_and_manifest(); rows[-1]['verifier_revision']='changed'
        with self.assertRaises(ValueError): metrics.report(manifest, rows)

class HookTests(unittest.TestCase):
    def test_installer_preserves_settings_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as td, patch('jevkit.cli.emit'):
            folder=Path(td)/'.claude'; folder.mkdir()
            original={'model':'sonnet','hooks':{'PostToolUse':[{'matcher':'Edit','hooks':[{'type':'command','command':'echo original'}]}]}}
            (folder/'settings.json').write_text(json.dumps(original))
            install(td, 'rules', 'observe'); install(td, 'jev', 'assist')
            result=json.loads((folder/'settings.json').read_text())
            self.assertEqual(result['model'], 'sonnet')
            self.assertEqual(len(result['hooks']['PostToolUse']), 2)
            self.assertEqual(result['hooks']['PostToolUse'][0], original['hooks']['PostToolUse'][0])
            self.assertEqual(json.loads((folder/'jev-agent-kit.json').read_text())['mode'], 'observe')
            self.assertTrue(list(folder.glob('settings.backup-*.json')))

    def test_disabled_does_not_call_pruning(self):
        from jevkit.cli import hook
        import io
        with tempfile.TemporaryDirectory() as td:
            event={'cwd':td,'tool_name':'Bash','tool_response':{'stdout':long_log()}}
            fake=type('Input', (), {'buffer':io.BytesIO(json.dumps(event).encode())})()
            with patch('sys.stdin', fake), patch('jevkit.core.prune') as prune:
                hook()
                prune.assert_not_called()

    def run_hook(self, cfg, mode='assist', override=None):
        with tempfile.TemporaryDirectory() as td:
            project=Path(td)/'project'; project.mkdir(); (project/'.claude').mkdir()
            (project/'.claude'/'jev-agent-kit.json').write_text(json.dumps(cfg))
            payload={'hook_event_name':'PostToolUse', 'cwd':str(project), 'session_id':'test',
                     'tool_name':'Bash','tool_input':{'command':'npm test'},
                     'tool_response':{'stdout':long_log(), 'stderr':'WARNING stderr evidence', 'interrupted':False,'isImage':False}}
            if override: payload['tool_response'].update(override)
            env=dict(os.environ, JEV_STATE_DIR=str(Path(td)/'state')); env.pop('TYPESAFE_API_KEY', None)
            completed=subprocess.run([sys.executable, 'jev.py', 'hook'], input=json.dumps(payload), text=True, capture_output=True, env=env)
            self.assertEqual(completed.returncode, 0)
            return completed.stdout

    def test_assist_rewrite_keeps_stderr(self):
        out=self.run_hook({'enabled':True,'mode':'assist','backend':'rules','minimumChars':0})
        response=json.loads(out)['hookSpecificOutput']['updatedToolOutput']
        self.assertEqual(response['stderr'], 'WARNING stderr evidence')
        self.assertIn('readback', response['stdout'])

    def test_observe_does_not_rewrite(self):
        self.assertEqual(self.run_hook({'enabled':True,'mode':'observe','backend':'rules'}), '')

    def test_disabled_no_response(self):
        self.assertEqual(self.run_hook({'enabled':False}), '')

    def test_interrupted_never_rewritten(self):
        self.assertEqual(self.run_hook({'enabled':True,'mode':'assist','backend':'rules','minimumChars':0}, override={'interrupted':True}), '')

class ModExclusionTests(unittest.TestCase):
    """The native Mod writes a per-session marker; the classic hook must then stay out."""

    def run_hook_with_marker(self, marker_session):
        with tempfile.TemporaryDirectory() as td:
            project=Path(td)/'project'; project.mkdir(); (project/'.claude').mkdir()
            (project/'.claude'/'jev-agent-kit.json').write_text(json.dumps({'enabled':True,'mode':'assist','backend':'rules','minimumChars':0}))
            state=Path(td)/'state'
            if marker_session is not None:
                marker=state/'mod-active'/core.digest(marker_session)[:24]
                marker.parent.mkdir(parents=True); marker.write_text('0.2.0')
            payload={'hook_event_name':'PostToolUse','cwd':str(project),'session_id':'session-a','tool_name':'Bash',
                     'tool_input':{'command':'npm test'},
                     'tool_response':{'stdout':long_log(),'stderr':'','interrupted':False,'isImage':False}}
            env=dict(os.environ, JEV_STATE_DIR=str(state)); env.pop('TYPESAFE_API_KEY', None)
            done=subprocess.run([sys.executable,'jev.py','hook'],input=json.dumps(payload),text=True,capture_output=True,env=env)
            self.assertEqual(done.returncode,0)
            return done.stdout

    def test_marker_for_this_session_silences_classic_hook(self):
        self.assertEqual(self.run_hook_with_marker('session-a'), '')

    def test_marker_for_another_session_does_not(self):
        self.assertIn('updatedToolOutput', self.run_hook_with_marker('session-b'))

    def test_no_marker_classic_hook_runs(self):
        self.assertIn('updatedToolOutput', self.run_hook_with_marker(None))

    def test_mod_active_rejects_bad_session_ids(self):
        for value in (None, '', 5, [], {}):
            self.assertFalse(core.mod_active(value))


GOLDEN = json.loads((Path(__file__).parent / 'fixtures' / 'golden.json').read_text(encoding='utf-8'))


class GoldenParityTests(unittest.TestCase):
    """tests/fixtures/golden.json is shared with the TypeScript core tests; both must agree."""

    def test_digests_match_fixture(self):
        for value, expected in GOLDEN['digests'].items():
            self.assertEqual(core.digest(value)[:24], expected)

    def test_fixture_files_are_in_sync_with_python_core(self):
        sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))
        import gen_golden
        as_json, as_ts = gen_golden.render()
        fixtures = Path(__file__).parent / 'fixtures'
        self.assertEqual((fixtures / 'golden.json').read_text(encoding='utf-8'), as_json)
        self.assertEqual((fixtures / 'golden.ts').read_text(encoding='utf-8'), as_ts)

    def test_prune_output_matches_fixture(self):
        for case in GOLDEN['cases']:
            output, meta = core.prune(case['input'], 'rules')
            self.assertEqual(output, case['expected_output'], case['name'])
            self.assertEqual(meta['input_chars'], case['expected_input_chars'], case['name'])
            self.assertEqual(meta['reason'], case['expected_reason'], case['name'])


class AuditRegressionTests(unittest.TestCase):
    """One test per finding of the independent audit (2026-10-10)."""

    def test_redaction_covers_bearer_json_and_quoted_secrets(self):
        for text, secret in [
            ('Authorization: Bearer abcdefSECRET123', 'abcdefSECRET123'),
            ('{"api_key": "SECRETJSON123", "password":"PW99"}', 'SECRETJSON123'),
            ('{"api_key": "SECRETJSON123", "password":"PW99"}', 'PW99'),
            ('password: "quoted secret"', 'secret'),
            ("token='single quoted value'", 'single quoted value'),
            ('Basic dXNlcjpwYXNz1234', 'dXNlcjpwYXNz1234'),
        ]:
            self.assertNotIn(secret, core.redact(text), text)
        self.assertEqual(core.redact('tokenizer is fine'), 'tokenizer is fine')

    def test_redaction_matches_fixture(self):
        for r in GOLDEN['redactions']:
            self.assertEqual(core.redact(r['input']), r['expected'])

    def test_private_files_and_every_new_directory_level_are_owner_only(self):
        with tempfile.TemporaryDirectory() as td:
            old = os.umask(0o022)  # a permissive umask must not leak into private state
            try:
                target = Path(td) / 'a' / 'b' / 'c' / 'f.log'
                core.private_write(target, 'x')
            finally:
                os.umask(old)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            for d in (target.parent, target.parent.parent, target.parent.parent.parent):
                self.assertEqual(d.stat().st_mode & 0o777, 0o700, str(d))

    def test_state_dir_expansion_and_relative_values_ignored(self):
        default = Path.home() / '.cache' / 'jev-agent-kit'
        cases = {'~/x': Path.home() / 'x', '~': Path.home(), '~other/x': default, 'relative/dir': default, '/abs/dir': Path('/abs/dir')}
        for raw, expected in cases.items():
            with patch.dict(os.environ, {'JEV_STATE_DIR': raw}):
                self.assertEqual(core.state_base(), expected, raw)

    def test_validation_accepts_integral_floats_like_json(self):
        self.assertEqual(core.config.__name__, 'config')
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / '.claude').mkdir()
            (Path(td) / '.claude' / 'jev-agent-kit.json').write_text('{"schemaVersion": 1.0}')
            self.assertEqual(core.config(td)['schemaVersion'], 1.0)

    def test_regex_semantics_are_ascii_only(self):
        filler = ''.join(f'filler {i}\n' for i in range(40))
        for special in ('FA\u0131L\n', 'at foo:\u0663\n'):
            out, _ = core.prune(filler + special + filler, 'rules')
            self.assertNotIn(special, out, repr(special))  # not treated as important

    def test_cleanup_runs_even_when_the_mod_owns_the_session(self):
        with tempfile.TemporaryDirectory() as td:
            project = Path(td) / 'project'; (project / '.claude').mkdir(parents=True)
            (project / '.claude' / 'jev-agent-kit.json').write_text(json.dumps({'enabled': True, 'retentionDays': 1}))
            state = Path(td) / 'state'
            root = state / core.digest(str(project.resolve()))[:24]
            old = root / 'artifacts' / ('a' * 32 + '.log'); old.parent.mkdir(parents=True); old.write_text('stale')
            os.utime(old, (1, 1))
            marker = state / 'mod-active' / core.digest('s1')[:24]; marker.parent.mkdir(parents=True); marker.write_text('x')
            payload = {'hook_event_name': 'PostToolUse', 'cwd': str(project), 'session_id': 's1', 'tool_name': 'Bash',
                       'tool_input': {'command': 'x'}, 'tool_response': {'stdout': long_log(), 'stderr': '', 'interrupted': False, 'isImage': False}}
            env = dict(os.environ, JEV_STATE_DIR=str(state))
            done = subprocess.run([sys.executable, 'jev.py', 'hook'], input=json.dumps(payload), text=True, capture_output=True, env=env)
            self.assertEqual(done.stdout, '')
            self.assertFalse(old.exists())


class HookInvariantTests(HookTests):
    """Invariant paths of the classic hook that were previously untested."""

    def test_image_result_never_rewritten(self):
        self.assertEqual(self.run_hook({'enabled': True, 'mode': 'assist', 'backend': 'rules', 'minimumChars': 0}, override={'isImage': True}), '')

    def test_missing_tool_fields_not_rewritten(self):
        with tempfile.TemporaryDirectory() as td:
            project = Path(td) / 'p'; (project / '.claude').mkdir(parents=True)
            (project / '.claude' / 'jev-agent-kit.json').write_text(json.dumps({'enabled': True, 'mode': 'assist', 'backend': 'rules', 'minimumChars': 0}))
            payload = {'hook_event_name': 'PostToolUse', 'cwd': str(project), 'session_id': 's', 'tool_name': 'Bash',
                       'tool_input': {'command': 'x'}, 'tool_response': {'stdout': long_log(), 'stderr': ''}}
            env = dict(os.environ, JEV_STATE_DIR=str(Path(td) / 'state'))
            done = subprocess.run([sys.executable, 'jev.py', 'hook'], input=json.dumps(payload), text=True, capture_output=True, env=env)
            self.assertEqual(done.stdout, '')
            rows = [json.loads(f.read_text()) for f in (Path(td) / 'state').rglob('decisions/*.json')]
            self.assertTrue(any(r.get('reason') == 'missing_tool_fields' for r in rows))

    def test_failure_event_is_observed_never_rewritten(self):
        with tempfile.TemporaryDirectory() as td:
            project = Path(td) / 'p'; (project / '.claude').mkdir(parents=True)
            (project / '.claude' / 'jev-agent-kit.json').write_text(json.dumps({'enabled': True, 'mode': 'assist', 'backend': 'rules', 'minimumChars': 0}))
            payload = {'hook_event_name': 'PostToolUseFailure', 'cwd': str(project), 'session_id': 's', 'tool_name': 'Bash',
                       'tool_input': {'command': 'x'}, 'error': long_log(), 'is_interrupt': False}
            env = dict(os.environ, JEV_STATE_DIR=str(Path(td) / 'state'))
            done = subprocess.run([sys.executable, 'jev.py', 'hook'], input=json.dumps(payload), text=True, capture_output=True, env=env)
            self.assertEqual(done.stdout, '')
            rows = [json.loads(f.read_text()) for f in (Path(td) / 'state').rglob('decisions/*.json')]
            self.assertTrue(any(r.get('feature') == 'loop' for r in rows))

    def test_delivered_chars_equals_input_when_not_rewritten(self):
        with tempfile.TemporaryDirectory() as td:
            project = Path(td) / 'p'; (project / '.claude').mkdir(parents=True)
            (project / '.claude' / 'jev-agent-kit.json').write_text(json.dumps({'enabled': True, 'mode': 'assist', 'backend': 'rules', 'minimumChars': 0}))
            payload = {'hook_event_name': 'PostToolUse', 'cwd': str(project), 'session_id': 's', 'tool_name': 'Bash',
                       'tool_input': {'command': 'x'}, 'tool_response': {'stdout': long_log(), 'stderr': '', 'interrupted': True, 'isImage': False}}
            env = dict(os.environ, JEV_STATE_DIR=str(Path(td) / 'state'))
            subprocess.run([sys.executable, 'jev.py', 'hook'], input=json.dumps(payload), text=True, capture_output=True, env=env)
            rows = [json.loads(f.read_text()) for f in (Path(td) / 'state').rglob('decisions/*.json')]
            prune = [r for r in rows if r.get('reason') == 'ok'][0]
            self.assertEqual(prune['delivered_chars'], prune['input_chars'])


class SettingsLayerTests(unittest.TestCase):
    """Plugin settings (userConfig) reach the classic hook as CLAUDE_PLUGIN_OPTION_* variables."""

    def cfg(self, env, project=None):
        with tempfile.TemporaryDirectory() as td:
            if project is not None:
                (Path(td) / '.claude').mkdir()
                (Path(td) / '.claude' / 'jev-agent-kit.json').write_text(json.dumps(project))
            return core.config(td, env)

    def test_precedence_defaults_then_plugin_settings_then_project(self):
        env = {'CLAUDE_PLUGIN_OPTION_MODE': 'assist', 'CLAUDE_PLUGIN_OPTION_RETENTION_DAYS': '14'}
        result = self.cfg(env, {'mode': 'observe', 'enabled': True})
        self.assertEqual((result['mode'], result['retentionDays'], result['enabled']), ('observe', 14, True))

    def test_bad_plugin_option_ignored_bad_project_file_rejected(self):
        self.assertEqual(self.cfg({'CLAUDE_PLUGIN_OPTION_MODE': 'bogus'})['mode'], 'observe')
        self.assertEqual(core.user_defaults({'CLAUDE_PLUGIN_OPTION_KEEP_THRESHOLD': '7', 'CLAUDE_PLUGIN_OPTION_MINIMUM_CHARS': '5000'}), {'minimumChars': 5000})
        with self.assertRaises(ValueError):
            self.cfg({}, {'endpoint': 'https://evil.example'})

    def test_enable_everywhere_is_user_level_and_project_can_refuse(self):
        env = {'CLAUDE_PLUGIN_OPTION_ENABLE_ALL_PROJECTS': 'true'}
        self.assertTrue(self.cfg(env)['enabled'])
        self.assertFalse(self.cfg(env, {'enabled': False})['enabled'])
        self.assertFalse(self.cfg({})['enabled'])

    def test_matches_golden_merge_cases(self):
        names = {'mode': 'MODE', 'backend': 'BACKEND', 'minimum_chars': 'MINIMUM_CHARS', 'keep_threshold': 'KEEP_THRESHOLD',
                 'retention_days': 'RETENTION_DAYS', 'enable_all_projects': 'ENABLE_ALL_PROJECTS'}
        for case in GOLDEN['merges']:
            env = {'CLAUDE_PLUGIN_OPTION_' + names[k]: str(v).lower() if isinstance(v, bool) else str(v) for k, v in case['options'].items()}
            if 'error' in case['expected']:
                with self.assertRaises(ValueError):
                    self.cfg(env, case['project'])
            else:
                self.assertEqual(self.cfg(env, case['project']), case['expected'])

    def test_plugin_key_only_real_values(self):
        self.assertEqual(core.plugin_key({'CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY': 'k-1'}), 'k-1')
        self.assertIsNone(core.plugin_key({'CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY': 'REPLACE_ME'}))
        self.assertIsNone(core.plugin_key({}))

    def test_classic_hook_runs_for_a_project_without_file_when_enabled_everywhere(self):
        with tempfile.TemporaryDirectory() as td:
            project = Path(td) / 'p'; project.mkdir()
            payload = {'hook_event_name': 'PostToolUse', 'cwd': str(project), 'session_id': 's', 'tool_name': 'Bash', 'tool_input': {'command': 'x'},
                       'tool_response': {'stdout': long_log(), 'stderr': '', 'interrupted': False, 'isImage': False}}
            env = dict(os.environ, JEV_STATE_DIR=str(Path(td) / 'state'), CLAUDE_PLUGIN_OPTION_ENABLE_ALL_PROJECTS='true',
                       CLAUDE_PLUGIN_OPTION_MODE='assist', CLAUDE_PLUGIN_OPTION_MINIMUM_CHARS='100')
            env.pop('TYPESAFE_API_KEY', None)
            done = subprocess.run([sys.executable, 'jev.py', 'hook'], input=json.dumps(payload), text=True, capture_output=True, env=env)
            self.assertIn('updatedToolOutput', done.stdout)

if __name__=='__main__': unittest.main()
