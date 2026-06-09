const fs = require('fs');
const path = require('path');

function clearMeasurements() {
  const projectsFile = path.join(__dirname, 'data', 'projects.json');
  if (!fs.existsSync(projectsFile)) {
    console.error('projects.json not found!');
    return;
  }

  try {
    const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
    const idx = projects.findIndex(p => p.name === 'Örnek Daire Ölçümü');
    if (idx >= 0) {
      projects[idx].measurements = [];
      projects[idx].updatedAt = new Date().toISOString();
      fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf8');
      console.log('Successfully cleared measurements for Örnek Daire Ölçümü!');
    } else {
      console.error('Örnek Daire Ölçümü not found in projects.json');
    }
  } catch (e) {
    console.error('Error clearing measurements:', e);
  }
}

clearMeasurements();
