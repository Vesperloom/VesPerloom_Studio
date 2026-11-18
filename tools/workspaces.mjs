import { home } from '../server/config.mjs';
import { changeKey, readKeys } from '../server/accounts/keys.mjs';
const [action, id] = process.argv.slice(2);
try {
  if (action === 'list')
    console.log(
      ((await readKeys(home)) || []).map((a) => a.id).join('\n') || 'No named workspaces.',
    );
  else {
    const key = await changeKey(home, action, id);
    console.log(`${action}: ${id}. Restart the server to apply the key registry.`);
    if (key) console.log(`Workspace token (shown once; store privately):\n${key}`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
