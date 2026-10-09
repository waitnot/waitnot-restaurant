exports.default = async function(context) {
  const path = require('path');
  const fs = require('fs');
  const toDelete = [
    'LICENSES.chromium.html',
    'vk_swiftshader.dll',
    'vk_swiftshader_icd.json',
    'vulkan-1.dll',
  ];
  for (const f of toDelete) {
    const p = path.join(context.appOutDir, f);
    try { fs.unlinkSync(p); console.log('removed', f); } catch(e) {}
  }
};
