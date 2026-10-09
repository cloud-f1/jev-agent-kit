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

if __name__=='__main__': unittest.main()
