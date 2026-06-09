const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadFloorplan() {
  const imgPath = path.join(__dirname, 'public', 'Örnek Daire plan (metrik).jpg');
  if (!fs.existsSync(imgPath)) {
    console.error('Error: Image file not found at', imgPath);
    process.exit(1);
  }

  console.log('Reading image file...');
  const base64Data = fs.readFileSync(imgPath).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Data}`;

  const projectsFile = path.join(__dirname, 'data', 'projects.json');
  let projects = [];
  if (fs.existsSync(projectsFile)) {
    try {
      projects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
    } catch (e) {
      console.warn('Could not parse projects.json, creating new list.');
    }
  }

  const existingIdx = projects.findIndex(p => p.name === 'Örnek Daire Ölçümü');
  if (existingIdx >= 0) {
    console.log('Updating existing Örnek Daire Ölçümü...');
    projects[existingIdx].floorplan = dataUrl;
    projects[existingIdx].updatedAt = new Date().toISOString();
  } else {
    console.log('Creating new Örnek Daire Ölçümü...');
    const newProject = {
      id: crypto.randomUUID(),
      name: 'Örnek Daire Ölçümü',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      floorplan: dataUrl,
      floorplanDrawing: null,
      scale: null,
      measurements: []
    };
    projects.push(newProject);
  }

  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf8');
  console.log('Successfully preloaded floorplan into projects.json!');
}

loadFloorplan();
