import * as THREE from "three";
import type { PortraitFrame } from "./layout";

/** Scene-owned resources are shared by every portrait and released together at teardown. */
export function createPortraitFrames() {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const indigo = new THREE.MeshStandardMaterial({ color: "#292b50", roughness: .74, metalness: .08 });
  const tile = new THREE.MeshStandardMaterial({ color: "#45416f", roughness: .6, metalness: .12 });
  const charcoal = new THREE.MeshStandardMaterial({ color: "#211722", roughness: .82 });
  const copper = new THREE.MeshStandardMaterial({ color: "#b87943", roughness: .4, metalness: .52 });
  const materials = [indigo, tile, charcoal, copper];
  const unitTile = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(-.43, -.43), new THREE.Vector2(.43, -.43),
    new THREE.Vector2(.43, .43), new THREE.Vector2(-.43, .43),
  ]), { depth: .6, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .07, bevelThickness: .1, curveSegments: 1 });
  unitTile.translate(0, 0, -.3);

  function ring(width: number, height: number, band: number, depth: number) {
    const key = `${width}:${height}:${band}:${depth}`;
    let geometry = geometries.get(key);
    if (!geometry) {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
      shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-width / 2 + band, band); hole.lineTo(-width / 2 + band, height - band);
      hole.lineTo(width / 2 - band, height - band); hole.lineTo(width / 2 - band, band); hole.closePath();
      shape.holes.push(hole);
      geometry = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: true, bevelSegments: 2, steps: 1,
        bevelSize: Math.min(.005, band * .22), bevelThickness: .004, curveSegments: 1,
      });
      geometries.set(key, geometry);
    }
    return geometry;
  }

  function build(width: number, frame: PortraitFrame) {
    const group = new THREE.Group();
    group.name = "Decorated portrait frame";
    const { height, inset } = frame;
    function molding(offset: number, band: number, depth: number, z: number, material: THREE.Material) {
      const mesh = new THREE.Mesh(ring(width - offset * 2, height - offset * 2, band, depth), material);
      mesh.position.set(0, offset, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    }
    molding(0, inset, .045, 0, charcoal);
    molding(.006, inset * .45, .035, .043, indigo);
    molding(inset * .42, inset * .09, .018, .08, copper);
    molding(inset * .55, inset * .24, .025, .06, indigo);
    molding(inset * .79, inset * .16, .024, .08, charcoal);
    molding(inset * .95, inset * .05, .012, .099, copper);

    function tiledBorder(offset: number, size: number, z: number, material: THREE.Material, studs = false) {
      const w = width - offset * 2, h = height - offset * 2;
      const columns = Math.max(2, Math.round(w / (size * 1.08)));
      const rows = Math.max(2, Math.round(h / (size * 1.08)));
      const mesh = new THREE.InstancedMesh(unitTile, material, columns * 2 + (rows - 1) * 2);
      const dummy = new THREE.Object3D();
      let index = 0;
      function add(x: number, y: number, sx: number, sy: number) {
        dummy.position.set(x, y, z); dummy.scale.set(sx, sy, studs ? .012 : .022);
        dummy.rotation.z = studs ? Math.PI / 4 : 0; dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index++, new THREE.Color().setScalar(.82 + (index % 5) * .065));
      }
      for (let i = 0; i < columns; i++) {
        const x = -w / 2 + (i + .5) * w / columns;
        add(x, offset, w / columns * .9, size); add(x, height - offset, w / columns * .9, size);
      }
      for (let i = 1; i < rows; i++) {
        const y = offset + i * h / rows;
        add(-w / 2, y, size, h / rows * .9); add(w / 2, y, size, h / rows * .9);
      }
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    tiledBorder(inset * .23, inset * .29, .083, tile);
    tiledBorder(inset * .465, inset * .055, .105, copper, true);
    return group;
  }

  return {
    build,
    remove(group: THREE.Group) {
      group.removeFromParent();
      group.traverse((node) => { if (node instanceof THREE.InstancedMesh) node.dispose(); });
    },
    dispose() {
      geometries.forEach((geometry) => geometry.dispose()); unitTile.dispose();
      materials.forEach((material) => material.dispose());
    },
  };
}
