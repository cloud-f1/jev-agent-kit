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

    def test_readback_rejects_bad_ids_and_restores_stored_originals(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / 'artifacts').mkdir()
            (Path(td) / 'artifacts' / ('a' * 32 + '.log')).write_text('original')
            self.assertEqual(core.readback(td, 'a' * 32), 'original')
            for bad in ('../x', 'A' * 32, 'a' * 31, '', 'a' * 32 + '/..'):
                with self.assertRaises(ValueError):
                    core.readback(td, bad)

    def test_transport_fields_cannot_be_project_config(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'.claude'; path.mkdir()
            (path/'jev-agent-kit.json').write_text('{"endpoint":"https://other"}')
            with self.assertRaises(ValueError): core.config(td)

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


class ModelAcceptanceTests(unittest.TestCase):
    def test_any_jev_model_in_a_response_is_accepted_others_rejected(self):
        usage = {'input_tokens': 5, 'output_tokens': 0}
        def respond(model):
            return {'model': model, 'usage': usage, 'answers': {'b1': {'type': 'noul', 'noul': 0.9}}}
        class Resp:
            def __init__(self, obj): self.obj = obj
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self, n=-1): return json.dumps(self.obj).encode()
        for model, ok in (('jev-1.13.0', True), ('jev-latest', True), ('jev-1.99.0', True), ('gpt-4', False), ('', False), (None, False), ('jev-', False), ('jev-' + 'a' * 41, False), ('jev-x\n', False), (7, False)):
            opener = type('O', (), {'open': lambda self, req, timeout=0, m=model: Resp(respond(m))})()
            with patch.dict(os.environ, {'TYPESAFE_API_KEY': 'k-12345678'}), patch('urllib.request.build_opener', return_value=opener):
                if ok:
                    self.assertEqual(core.request({'model': 'jev-latest'})['model'], model)
                else:
                    with self.assertRaises(core.JevError):
                        core.request({'model': 'jev-latest'})

    def test_pinned_model_must_answer_as_itself(self):
        usage = {'input_tokens': 5, 'output_tokens': 0}
        class Resp:
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self, n=-1): return json.dumps({'model': 'jev-1.99.0', 'usage': usage}).encode()
        opener = type('O', (), {'open': lambda self, req, timeout=0: Resp()})()
        with patch.dict(os.environ, {'TYPESAFE_API_KEY': 'k-12345678'}), patch('urllib.request.build_opener', return_value=opener):
            with self.assertRaises(core.JevError) as ctx:
                core.request({'model': 'jev-1.13.0'})
            self.assertEqual(str(ctx.exception), 'model_mismatch')

if __name__=='__main__': unittest.main()
