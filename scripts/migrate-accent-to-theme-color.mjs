import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function importPath(file) {
  const rel = path.relative(path.dirname(file), path.join(srcRoot, 'theme', 'theme.js'));
  return rel.split(path.sep).join('/');
}

function migrateContent(content, file) {
  if (!content.includes('accent-')) return null;

  let out = content;

  out = out.replace(/className="([^"]*accent-[^"]*)"/g, (_, classes) => {
    const migrated = classes.replace(/accent-/g, '${THEME_COLOR}-');
    return `className={\`${migrated}\`}`;
  });

  out = out.replace(/'([^']*?)accent-([^']*?)'/g, (_, pre, post) => {
    return `\`${pre}\${THEME_COLOR}-${post}\``;
  });

  out = out.replace(/`([^`]*?)accent-/g, (match, pre) => {
    if (pre.includes('${THEME_COLOR}-')) return match;
    return `\`${pre}\${THEME_COLOR}-`;
  });

  out = out.replace(/\$\{THEME_COLOR\}-\$\{THEME_COLOR\}-/g, '${THEME_COLOR}-');

  if (!out.includes('${THEME_COLOR}-')) return null;

  if (!/import\s*\{[^}]*THEME_COLOR[^}]*\}\s*from/.test(out)) {
    const imp = `import { THEME_COLOR } from '${importPath(file)}';\n`;
    const firstImport = out.match(/^import .+;\r?\n/m);
    if (firstImport) {
      out = out.replace(firstImport[0], `${firstImport[0]}${imp}`);
    } else {
      out = out + imp;
      out = imp + out.replace(imp, '');
    }
  }

  return out;
}

for (const file of walk(srcRoot)) {
  if (file.replace(/\\/g, '/').endsWith('theme/theme.js')) continue;
  if (file.replace(/\\/g, '/').endsWith('theme/tw.js')) continue;
  const original = fs.readFileSync(file, 'utf8');
  const migrated = migrateContent(original, file);
  if (migrated && migrated !== original) {
    fs.writeFileSync(file, migrated);
    console.log('migrated', path.relative(srcRoot, file));
  }
}