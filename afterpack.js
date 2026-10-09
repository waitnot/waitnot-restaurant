exports.default = async function(context) {
  const path = require('path');
  const fs = require('fs');
  // Remove files not needed at runtime to reduce install size
  const toDelete = [
    'LICENSES.chromium.html',   // 8.7 MB - legal text, not needed at runtime
    'vk_swiftshader.dll',       // 5.0 MB - Vulkan software renderer, not used
    'vk_swiftshader_icd.json',  // Vulkan config
    'vulkan-1.dll',             // 0.9 MB - Vulkan loader, not used
  ];
  // Also remove SumatraPDF from asar.unpacked (12 MB, only used for PDF printing)
  const sumatraPath = path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe');
  toDelete.push(sumatraPath);

  for (const f of toDelete) {
    const p = path.isAbsolute(f) ? f : path.join(context.appOutDir, f);
    try { fs.unlinkSync(p); console.log('[afterpack] removed', path.basename(p)); } catch(e) {}
  }
};
