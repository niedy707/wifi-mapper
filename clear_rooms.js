// Tüm oda çizimlerini (draw-rect ve room-polygon) sil, diğer çizimleri koru
const fs = require('fs');
const path = require('path');

const projectsFile = path.join(__dirname, 'data', 'projects.json');
const data = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));

let totalRemoved = 0;

Object.values(data).forEach(project => {
  if (project.floorplanDrawing && Array.isArray(project.floorplanDrawing)) {
    const before = project.floorplanDrawing.length;
    project.floorplanDrawing = project.floorplanDrawing.filter(
      shape => shape.type !== 'draw-rect' && shape.type !== 'room-polygon'
    );
    const removed = before - project.floorplanDrawing.length;
    totalRemoved += removed;
    console.log(`Proje "${project.name || 'isimsiz'}": ${removed} oda silindi (${project.floorplanDrawing.length} çizim kaldı)`);
  }
});

fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));
console.log(`\nToplam ${totalRemoved} oda çizimi silindi. Sayfayı yenileyerek kontrol edin.`);
