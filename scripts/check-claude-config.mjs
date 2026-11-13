import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';

// Uses the workspace's already-installed js-yaml; no model/API calls or secrets.
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const read = path => readFileSync(path, 'utf8');
const expected = ['backend-api', 'code-review', 'database-prisma', 'imports-files-integrations', 'project-audit', 'qa-testing', 'rbac-security', 'telegram-mini-app', 'ui-ux-redesign'];
function frontmatter(path) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(read(path));
  assert.ok(match, `Missing frontmatter: ${path}`);
  const data = yaml.load(match[1]);
  assert.ok(data && typeof data === 'object', path);
  assert.equal(typeof data.description, 'string', path);
  assert.ok(data.description.length > 0, path);
  return data;
}
const models = {implementation: 'sonnet', 'quick-scout': 'haiku', 'security-reviewer': 'sonnet'};
assert.deepEqual(readdirSync('.claude/agents').filter(p => p.endsWith('.md')).sort(), Object.keys(models).map(p => `${p}.md`).sort());
for (const [name, model] of Object.entries(models)) {
  const data = frontmatter(`.claude/agents/${name}.md`);
  assert.equal(data.name, name);
  assert.equal(data.model, model);
  assert.ok(Object.keys(data).every(k => ['name', 'description', 'model', 'tools'].includes(k)), name);
  const tools = data.tools.split(/,\s*/);
  assert.ok(!tools.includes('Agent'), name);
  if (name !== 'implementation') assert.deepEqual(tools.sort(), ['Glob', 'Grep', 'Read']);
  else assert.deepEqual(tools.sort(), ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write']);
}
assert.deepEqual(readdirSync('.claude/skills').sort(), expected.sort());
for (const name of expected) assert.equal(frontmatter(`.claude/skills/${name}/SKILL.md`).name, name);
// Parse repository JSON settings only if present. Never inspect user credentials.
for (const path of ['.claude/settings.json', '.claude/settings.local.json', '.mcp.json']) {
  if (existsSync(path)) { JSON.parse(read(path)); console.log(`JSON syntax OK: ${path} (values not printed)`); }
}
const main = read('CLAUDE.md');
for (const path of ['docs/PROJECT_CONTEXT.md', 'docs/FEATURE_MATRIX.md', 'docs/ARCHITECTURE.md', 'docs/DATABASE.md', 'docs/PERMISSIONS.md', 'docs/DEVELOPMENT_LOG.md', 'docs/CLAUDE_CODE_CONFIG.md', '.claude/rules/git-workflow.md']) assert.ok(existsSync(path), `Broken reference: ${path}`);
for (const name of expected) assert.ok(main.includes(`\`${name}\``), `Missing skill routing: ${name}`);
for (const term of ['SurveySubmission', 'SquadMember', 'programItemId', 'timezone', 'paymentNote', 'scope', 'permissions', 'initDataUnsafe', 'ROLE_PERMISSIONS', 'DISTINCT shiftId']) assert.ok(main.includes(term), `Missing invariant: ${term}`);
assert.ok(!main.includes('Before making architectural or implementation decisions, read all three files completely.'));
const audit = read('.claude/skills/project-audit/SKILL.md');
assert.ok(!audit.includes('docs/audit/FEATURE-MATRIX.md'));
assert.ok(!audit.includes('docs/architecture/DECISIONS.md'));
console.log('PASS: 3 agents, explicit aliases/tool allowlists, 9 skills, JSON syntax (if present), references and selected invariant markers.');
console.log('Static project contract check, not the complete Claude Code schema or a live Tooken routing/security test.');
