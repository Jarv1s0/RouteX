import fs from 'fs';
import YAML from 'yaml';

const file = 'electron-builder.yml';
try {
  const content = fs.readFileSync(file, 'utf8');
  const doc = YAML.parse(content);

  const inject = (s) => {
    if (!s) return s;
    // Replace 'RouteX-${version}' with 'RouteX-Autobuild-${version}'
    return s.replace('RouteX-${version}', 'RouteX-Autobuild-${version}');
  };

  if (doc.artifactName) doc.artifactName = inject(doc.artifactName);
  
  if (doc.win) {
    if (doc.win.artifactName) doc.win.artifactName = inject(doc.win.artifactName);
  }
  
  if (doc.nsis) {
    if (doc.nsis.artifactName) doc.nsis.artifactName = inject(doc.nsis.artifactName);
  }
  
  if (doc.linux) {
    if (doc.linux.artifactName) doc.linux.artifactName = inject(doc.linux.artifactName);
  }
  
  if (doc.mac) {
    if (doc.mac.artifactName) doc.mac.artifactName = inject(doc.mac.artifactName);
  }

  fs.writeFileSync(file, YAML.stringify(doc));
  console.log('✅ Successfully patched electron-builder.yml with Autobuild artifact names.');
} catch (error) {
  console.error('❌ Failed to patch electron-builder.yml:', error);
  process.exit(1);
}
