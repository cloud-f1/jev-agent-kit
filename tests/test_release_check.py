import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import release_check as rc  # noqa: E402


def make_repo(root, py='0.2.0', ts='0.2.0', plugin='0.2.0', changelog='## 0.2.0 (2026-10-10)\n', hooks_modules=('./register.ts',),
              plugin_extra=None, market_names=('jev-agent-kit',)):
    root = Path(root)
    (root / 'jevkit').mkdir(); (root / 'core').mkdir(); (root / 'hooks').mkdir(); (root / '.claude-plugin').mkdir()
    (root / 'jevkit' / 'core.py').write_text(f"VERSION = '{py}'\n")
    (root / 'core' / 'contracts.ts').write_text(f"export const VERSION = '{ts}'\n")
    manifest = {'name': 'jev-agent-kit', 'version': plugin, **(plugin_extra or {})}
    (root / '.claude-plugin' / 'plugin.json').write_text(json.dumps(manifest))
    (root / '.claude-plugin' / 'marketplace.json').write_text(json.dumps({'plugins': [{'name': n} for n in market_names]}))
    (root / 'hooks' / 'hooks.json').write_text(json.dumps({'modules': list(hooks_modules)}))
    for module in hooks_modules:
        (root / 'hooks' / module).write_text('export function register() {}\n')
    (root / 'CHANGELOG.md').write_text('# Changelog\n\n' + changelog)
    return root


def statuses(results):
    return {r.name: r.status for r in results}


class VersionTests(unittest.TestCase):
    def test_all_agree(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(statuses(rc.check_versions(make_repo(td)))['versions agree'], rc.PASS)

    def test_each_file_drifting_fails(self):
        for field in ('py', 'ts', 'plugin'):
            with self.subTest(field), tempfile.TemporaryDirectory() as td:
                root = make_repo(td, **{field: '0.1.0'})
                self.assertEqual(statuses(rc.check_versions(root))['versions agree'], rc.FAIL)

    def test_changelog_drift_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = make_repo(td, changelog='## 0.1.0 (2026-01-01)\n')
            self.assertEqual(statuses(rc.check_versions(root))['versions agree'], rc.FAIL)

    def test_missing_version_marker_fails_not_passes(self):
        with tempfile.TemporaryDirectory() as td:
            root = make_repo(td)
            (root / 'jevkit' / 'core.py').write_text('# no version here\n')
            self.assertEqual(statuses(rc.check_versions(root))['versions agree'], rc.FAIL)

    def test_release_requires_dated_changelog(self):
        with tempfile.TemporaryDirectory() as td:
            root = make_repo(td, changelog='## 0.2.0 (unreleased)\n')
            self.assertEqual(statuses(rc.check_versions(root, release=False)).get('changelog dated for release'), None)
            self.assertEqual(statuses(rc.check_versions(root, release=True))['changelog dated for release'], rc.FAIL)

    def test_release_accepts_dated_or_plain_heading(self):
        for heading in ('## 0.2.0 (2026-10-10)\n', '## 0.2.0\n'):
            with self.subTest(heading), tempfile.TemporaryDirectory() as td:
                root = make_repo(td, changelog=heading)
                self.assertEqual(statuses(rc.check_versions(root, release=True))['changelog dated for release'], rc.PASS)


class ManifestTests(unittest.TestCase):
    def test_consistent_manifests_pass(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(statuses(rc.check_manifests(make_repo(td)))['manifests consistent'], rc.PASS)

    def test_default_enabled_false_is_rejected(self):
        # Regression: with defaultEnabled:false a --plugin-dir load registered no module and no hooks.
        with tempfile.TemporaryDirectory() as td:
            root = make_repo(td, plugin_extra={'defaultEnabled': False})
            result = rc.check_manifests(root)[0]
            self.assertEqual(result.status, rc.FAIL)
            self.assertIn('defaultEnabled', result.detail)

    def test_plugin_missing_from_marketplace(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(rc.check_manifests(make_repo(td, market_names=('other',)))[0].status, rc.FAIL)

    def test_declared_module_must_exist(self):
        with tempfile.TemporaryDirectory() as td:
            root = make_repo(td)
            (root / 'hooks' / 'register.ts').unlink()
            self.assertEqual(rc.check_manifests(root)[0].status, rc.FAIL)

    def test_unparseable_manifest_fails(self):
        with tempfile.TemporaryDirectory() as td:
            root = make_repo(td)
            (root / '.claude-plugin' / 'plugin.json').write_text('{not json')
            self.assertEqual(rc.check_manifests(root)[0].status, rc.FAIL)


class SecretScanTests(unittest.TestCase):
    def test_clean_files_pass(self):
        self.assertEqual(rc.scan_secrets({'a.md': 'TYPESAFE_API_KEY=REPLACE_ME\nexport TYPESAFE_API_KEY=...'}).status, rc.PASS)

    def test_detects_each_kind_and_never_echoes_the_secret(self):
        samples = {
            'k1.txt': 'key sk-' + 'a' * 24,
            'k2.txt': 'tok ghp_' + 'b' * 30,
            'k3.txt': 'AKIA' + 'C' * 16,
            'k4.txt': '-----BEGIN RSA PRIVATE KEY-----',
            'k5.txt': 'TYPESAFE_API_KEY=realvalue12345',
        }
        result = rc.scan_secrets(samples)
        self.assertEqual(result.status, rc.FAIL)
        for path in samples:
            self.assertIn(path, result.detail)
        for secret in ('a' * 24, 'b' * 30, 'realvalue12345'):
            self.assertNotIn(secret, result.detail)

    def test_exempt_files_are_skipped(self):
        self.assertEqual(rc.scan_secrets({'scripts/release_check.py': 'sk-' + 'a' * 24}).status, rc.PASS)
        self.assertEqual(rc.scan_secrets({'tests/fixtures/x.json': 'sk-' + 'a' * 24}).status, rc.PASS)
        # ...but the same value anywhere else is caught, including look-alike prefixes.
        self.assertEqual(rc.scan_secrets({'src/x.py': 'sk-' + 'a' * 24}).status, rc.FAIL)
        self.assertEqual(rc.scan_secrets({'mytests/x.py': 'sk-' + 'a' * 24}).status, rc.FAIL)


class AuditRegressionTests(unittest.TestCase):
    def test_quoted_and_json_style_keys_are_caught(self):
        for text in ('TYPESAFE_API_KEY="ts_live_abcdef123456"', "TYPESAFE_API_KEY='ts_live_abcdef123456'",
                     '{"TYPESAFE_API_KEY": "ts_live_abcdef123456"}', 'TYPESAFE_API_KEY: ts_live_abcdef123456'):
            self.assertEqual(rc.scan_secrets({'x.json': text}).status, rc.FAIL, text)
        self.assertEqual(rc.scan_secrets({'x': 'TYPESAFE_API_KEY="REPLACE_ME"'}).status, rc.PASS)

    def test_non_utf8_tracked_file_is_still_scanned(self):
        with tempfile.TemporaryDirectory() as td:
            import subprocess
            root = Path(td)
            subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
            (root / 'latin.txt').write_bytes(b'caf\xe9 TYPESAFE_API_KEY=ts_live_abcdef123456\n')
            subprocess.run(['git', 'add', '.'], cwd=root, check=True)
            files = rc.tracked_files(root)
            self.assertIn('latin.txt', files)
            self.assertEqual(rc.scan_secrets(files).status, rc.FAIL)

    def test_validation_summary_allows_only_the_known_claude_md_warning(self):
        ok = {'success': True, 'manifest': {'errors': [], 'warnings': []},
              'contents': [{'errors': [], 'warnings': [{'message': 'CLAUDE.md at the plugin root is not loaded as project context.'}]}]}
        self.assertEqual(rc.summarize_validation(ok).status, rc.PASS)
        other = {'success': True, 'manifest': {'errors': [], 'warnings': [{'message': 'No description'}]}, 'contents': []}
        self.assertEqual(rc.summarize_validation(other).status, rc.FAIL)
        err = {'success': False, 'manifest': {'errors': [{'message': 'bad'}], 'warnings': []}, 'contents': []}
        self.assertEqual(rc.summarize_validation(err).status, rc.FAIL)
        self.assertEqual(rc.summarize_validation({'success': False}).status, rc.FAIL)


class GateSemanticsTests(unittest.TestCase):
    def test_skipped_is_ok_in_dev_but_fails_a_release(self):
        results = [rc.Result('a', rc.PASS), rc.Result('b', rc.SKIPPED, 'cli missing')]
        self.assertEqual(rc.evaluate(results, release=False), 0)
        self.assertEqual(rc.evaluate(results, release=True), 1)

    def test_fail_always_blocks(self):
        for release in (False, True):
            self.assertEqual(rc.evaluate([rc.Result('a', rc.FAIL)], release), 1)

    def test_missing_tool_reports_skipped_not_pass(self):
        with tempfile.TemporaryDirectory() as td:
            result = rc.run_step('x', ['definitely-not-a-real-binary-xyz'], Path(td), 'tool absent')
            self.assertEqual(result.status, rc.SKIPPED)

    def test_failing_command_reports_fail_with_tail(self):
        with tempfile.TemporaryDirectory() as td:
            result = rc.run_step('x', [sys.executable, '-c', 'import sys; print("boom"); sys.exit(3)'], Path(td), '')
            self.assertEqual(result.status, rc.FAIL)
            self.assertIn('boom', result.detail)

    def test_passing_command_passes(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(rc.run_step('x', [sys.executable, '-c', 'pass'], Path(td), '').status, rc.PASS)


if __name__ == '__main__':
    unittest.main()
