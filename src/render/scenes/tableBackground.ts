import Phaser from 'phaser';
import { drawTable } from '../cardart/table';
import { TEX } from '../cardart/textures';

let drawnSize = '';

/** Tapis plein écran (texture partagée, dessinée à mi-résolution : c'est un fond doux). */
export function ensureTableImage(
  scene: Phaser.Scene,
  image?: Phaser.GameObjects.Image,
): Phaser.GameObjects.Image {
  const w = Math.max(2, Math.ceil(scene.scale.width / 2));
  const h = Math.max(2, Math.ceil(scene.scale.height / 2));
  let tex = scene.textures.exists(TEX.table) ? scene.textures.get(TEX.table) : null;
  if (!(tex instanceof Phaser.Textures.CanvasTexture)) {
    if (tex) scene.textures.remove(TEX.table);
    tex = scene.textures.createCanvas(TEX.table, w, h);
    drawnSize = '';
  }
  const canvas = tex as Phaser.Textures.CanvasTexture;
  if (drawnSize !== `${w}x${h}`) {
    canvas.setSize(w, h);
    drawTable(canvas.context, w, h);
    canvas.refresh();
    drawnSize = `${w}x${h}`;
  }
  const img = image ?? scene.add.image(0, 0, TEX.table).setOrigin(0, 0).setDepth(-10);
  img.setTexture(TEX.table).setDisplaySize(scene.scale.width, scene.scale.height);
  return img;
}
