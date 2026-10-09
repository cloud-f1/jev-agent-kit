#!/usr/bin/env python3
"""Local release gate for jev-agent-kit. Stdlib only; no network.

  python3 scripts/release_check.py            # development: everything that can run
  python3 scripts/release_check.py --release  # tagging: also requires clean main, a dated changelog,
                                              # and treats any SKIPPED check as a failure

Exit 0 only when no check FAILED (and, with --release, none SKIPPED). A check that cannot run
reports SKIPPED, never PASS: a gate that cannot check must not look green.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PASS, FAIL, SKIPPED = 'PASS', 'FAIL', 'SKIPPED'

SECRET_PATTERNS = {
    'openai-style key': re.compile(r'\bsk-[A-Za-z0-9_-]{16,}'),
    'github token': re.compile(r'\bgh[pousr]_[A-Za-z0-9]{20,}'),
    'aws access key': re.compile(r'\bAKIA[A-Z0-9]{16}\b'),
    'private key block': re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    # Unquoted, quoted, and JSON-style assignments of a real-looking value.
    'assigned typesafe key': re.compile(r'''TYPESAFE_API_KEY["']?\s*[:=]\s*["']?(?!REPLACE_ME\b)[^\s#"'$`,]{8,}'''),
}
# Files that legitimately contain secret-shaped FAKE values (redaction tests and their fixtures).
# Trade-off: a real key committed under tests/ would not be caught here; the contract in CLAUDE.md
# is that tests use obvious fakes, and reviewers should treat any new value in these paths with care.
SCAN_EXEMPT_FILES = {'scripts/release_check.py', 'scripts/gen_golden.py'}
SCAN_EXEMPT_PREFIXES = ('tests/',)


def is_exempt(path: str) -> bool:
    return path in SCAN_EXEMPT_FILES or path.startswith(SCAN_EXEMPT_PREFIXES)


@dataclass
class Result:
    name: str
    status: str
    detail: str = ''


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def python_version(root: Path) -> str | None:
    match = re.search(r"^VERSION\s*=\s*'([^']+)'", (root / 'jevkit' / 'core.py').read_text(encoding='utf-8'), re.M)
    return match.group(1) if match else None


def ts_version(root: Path) -> str | None:
    match = re.search(r"export const VERSION\s*=\s*'([^']+)'", (root / 'core' / 'contracts.ts').read_text(encoding='utf-8'))
    return match.group(1) if match else None


def changelog_head(root: Path) -> tuple[str | None, str]:
    """First `## <version> [(note)]` heading and its trailing note."""
    for line in (root / 'CHANGELOG.md').read_text(encoding='utf-8').splitlines():
        match = re.match(r'##\s+(\d+\.\d+\.\d+)\s*(?:\((.*)\))?\s*$', line)
        if match:
            return match.group(1), (match.group(2) or '')
    return None, ''


def check_versions(root: Path, release: bool = False) -> list[Result]:
    found = {
        'jevkit/core.py': python_version(root),
        'core/contracts.ts': ts_version(root),
        '.claude-plugin/plugin.json': read_json(root / '.claude-plugin' / 'plugin.json').get('version'),
    }
    log_version, note = changelog_head(root)
    found['CHANGELOG.md'] = log_version
    results = []
    if None in found.values() or len(set(found.values())) != 1:
        results.append(Result('versions agree', FAIL, ', '.join(f'{k}={v}' for k, v in found.items())))
    else:
        results.append(Result('versions agree', PASS, next(iter(found.values()))))
    if release:
        if 'unreleased' in note.lower():
            results.append(Result('changelog dated for release', FAIL, f'top entry still marked ({note})'))
        else:
            results.append(Result('changelog dated for release', PASS, note or 'no pre-release note'))
    return results


def check_manifests(root: Path) -> list[Result]:
    results = []
    try:
        plugin = read_json(root / '.claude-plugin' / 'plugin.json')
        market = read_json(root / '.claude-plugin' / 'marketplace.json')
        hooks = read_json(root / 'hooks' / 'hooks.json')
    except (OSError, ValueError) as exc:
        return [Result('manifests parse', FAIL, type(exc).__name__)]
    problems = []
    if plugin.get('defaultEnabled') is False:
        problems.append('plugin.json sets defaultEnabled:false (a --plugin-dir load then registers no module)')
    if plugin['name'] not in [p.get('name') for p in market.get('plugins', [])]:
        problems.append('plugin name missing from marketplace.json')
    for module in hooks.get('modules', []):
        if not (root / 'hooks' / module).is_file():
            problems.append(f'hooks module {module} does not exist')
    results.append(Result('manifests consistent', FAIL if problems else PASS, '; '.join(problems)))
    return results


def scan_secrets(files: dict[str, str]) -> Result:
    """`files` maps relative path -> text. Returns FAIL naming path and pattern, never the match."""
    hits = []
    for path, text in files.items():
        if is_exempt(path):
            continue
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                hits.append(f'{path}: {label}')
    return Result('no secrets in tracked files', FAIL if hits else PASS, '; '.join(hits))


def tracked_files(root: Path) -> dict[str, str] | None:
    git = shutil.which('git')
    if not git:
        return None
    done = subprocess.run([git, 'ls-files', '-z'], cwd=root, capture_output=True)
    if done.returncode != 0:
        return None
    files = {}
    for name in filter(None, done.stdout.decode().split('\0')):
        try:
            # Decode leniently: a secret in a latin-1 or binary-ish file must still be scanned.
            files[name] = (root / name).read_bytes().decode('utf-8', errors='replace')
        except OSError:
            continue  # tracked but deleted from the working tree
    return files


def check_git_state(root: Path) -> list[Result]:
    git = shutil.which('git')
    if not git:
        return [Result('clean main', SKIPPED, 'git not found')]
    branch = subprocess.run([git, 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=root, capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run([git, 'status', '--porcelain'], cwd=root, capture_output=True, text=True).stdout.strip()
    problems = []
    if branch != 'main':
        problems.append(f'on branch {branch!r}, release from main')
    if dirty:
        problems.append('working tree has uncommitted changes')
    return [Result('clean main', FAIL if problems else PASS, '; '.join(problems))]


def run_step(name: str, argv: list[str], root: Path, missing_ok_reason: str) -> Result:
    if not shutil.which(argv[0]):
        return Result(name, SKIPPED, missing_ok_reason)
    done = subprocess.run(argv, cwd=root, capture_output=True, text=True)
    if done.returncode == 0:
        return Result(name, PASS)
    tail = (done.stdout + done.stderr).strip().splitlines()[-3:]
    return Result(name, FAIL, ' | '.join(tail))


# Warnings we knowingly accept (the repo's own CLAUDE.md sits at the plugin root; it is guidance
# for contributors, not shipped context).
ALLOWED_WARNINGS = ('CLAUDE.md at the plugin root',)


def summarize_validation(report: dict) -> Result:
    problems = []
    parts = [report.get('manifest') or {}] + list(report.get('contents') or [])
    for part in parts:
        for item in part.get('errors', []):
            problems.append('error: ' + str(item.get('message', item)))
        for item in part.get('warnings', []):
            message = str(item.get('message', item))
            if not message.startswith(ALLOWED_WARNINGS):
                problems.append('warning: ' + message)
    if not report.get('success', False) and not problems:
        problems.append('validate reported failure')
    return Result('plugin validate', FAIL if problems else PASS, ' | '.join(problems[:3]))


def run_validate(root: Path) -> Result:
    if not shutil.which('claude'):
        return Result('plugin validate', SKIPPED, 'claude CLI not installed; manifest NOT validated')
    done = subprocess.run(['claude', 'plugin', 'validate', '--json', '.'], cwd=root, capture_output=True, text=True)
    try:
        return summarize_validation(json.loads(done.stdout))
    except ValueError:
        return Result('plugin validate', FAIL, 'unparseable validate output')


def evaluate(results: list[Result], release: bool) -> int:
    bad = {FAIL, SKIPPED} if release else {FAIL}
    return 1 if any(r.status in bad for r in results) else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--release', action='store_true')
    args = parser.parse_args(argv)
    results: list[Result] = []
    results += check_versions(ROOT, args.release)
    results += check_manifests(ROOT)
    files = tracked_files(ROOT)
    results.append(scan_secrets(files) if files is not None else Result('no secrets in tracked files', SKIPPED, 'git unavailable'))
    if args.release:
        results += check_git_state(ROOT)
    results.append(run_step('python tests', [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests'], ROOT, 'python unavailable'))
    results.append(run_step('mod tests (claude plugin test)', ['claude', 'plugin', 'test'], ROOT, 'claude CLI not installed; mod tests NOT run'))
    results.append(run_validate(ROOT))
    width = max(len(r.name) for r in results)
    for r in results:
        print(f'{r.status:8} {r.name:<{width}}  {r.detail}'.rstrip())
    code = evaluate(results, args.release)
    print('\nRESULT:', 'OK to proceed' if code == 0 else 'NOT OK: fix the lines above')
    return code


if __name__ == '__main__':
    sys.exit(main())
