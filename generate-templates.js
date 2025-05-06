// generate-templates.js
const fs = require('fs');
const path = require('path');

function generateTemplateJSON(inputDir, outputFile) {
  const fullInputPath = path.join(__dirname, inputDir);
  const fullOutputPath = path.join(__dirname, outputFile);

  fs.readdir(fullInputPath, (err, files) => {
    if (err) throw err;
    const imageFiles = files.filter(f =>
      /\.(png|jpe?g|webp)$/i.test(f)
    );
    fs.writeFileSync(fullOutputPath, JSON.stringify(imageFiles, null, 2));
    console.log(`✅ Wrote ${imageFiles.length} entries to ${outputFile}`);
  });
}

generateTemplateJSON('assets/templates/profile', 'assets/templates/cover.json');
generateTemplateJSON('assets/templates/poster', 'assets/templates/poster.json');
