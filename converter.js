async function generateDownloadLink(svgStrings, outputZip, filename, isBitmap, bbsize) {
  const createLink = (url, name) => addLinkToContainer(url, name, name);

  // Convert SVG to PNG and return data for sprite or PNG export
  const convertSvgToPng = async (svgData, name) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const assetId = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    return new Promise(resolve => canvas.toBlob(blob => resolve({
      blob, name: name.replace('.svg', '.png'), assetId, centerX: img.width / 2, centerY: img.height / 2
    }), 'image/png'));
  };

  // Create .sprite3 zip with PNG files and JSON file for Scratch
  const exportSprite3 = async (zip, costumes) => {
    zip.file("sprite.json", JSON.stringify({
      isStage: false, name: filename, variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
      currentCostume: 0, costumes, sounds: [], volume: 100, visible: true, x: 0, y: 0, size: 100, direction: 90,
      draggable: false, rotationStyle: "all around"
    }));
    zip.generateAsync({ type: "blob" }).then(blob => createLink(URL.createObjectURL(blob), `${filename}.sprite3`));
  };

  // Process SVGs based on type (bitmap or SVG)
  const files = await Promise.all(svgStrings.map(async ([svgData, name]) =>
    isBitmap ? convertSvgToPng(svgData, name) : { blob: new Blob([svgData], { type: 'image/svg+xml' }), name }
  ));

  // Check if any dimensions exceed limit
  const exceedsLimit = bbsize > 360;
  
  if (outputZip) {
    // Create ZIP file for all files regardless of format
    const zip = new JSZip();
    files.forEach(({ blob, name }) => zip.file(name, blob));
    zip.generateAsync({ type: "blob" }).then(blob => createLink(URL.createObjectURL(blob), `${filename}.zip`));
  } else if (isBitmap && exceedsLimit) {
    // Create .sprite3 if bitmap and exceeds size limits
    const zip = new JSZip();
    const costumes = files.map(({ blob, name, assetId, centerX, centerY }) => {
      zip.file(`${assetId}.png`, blob);
      return { name, bitmapResolution: 1, dataFormat: "png", assetId, md5ext: `${assetId}.png`, rotationCenterX: centerX, rotationCenterY: centerY };
    });
    exportSprite3(zip, costumes);
  } else {
    // Export each file individually
    files.forEach(({ blob, name }) => createLink(URL.createObjectURL(blob), name));
  }

  document.getElementById('downloadContainer').style.display = 'block';
}


function createCanvasWithImage(img, w, h, rotate = false) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (rotate) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  }
  ctx.drawImage(img, 0, 0, w, h);

  return canvas;
}

function addLinkToContainer(href, download, text) {
  const link = Object.assign(document.createElement('a'), {
    href,
    download,
    textContent: text,
    className: "btn btn-primary me-2 mb-2"
  });
  document.getElementById('downloadLinks').appendChild(link);
}


function generateSTTFFromImage(img, original_h, noWarp, singleTri, usePrimaryDiagonal, isRightAngled) {
  // Set dimensions based on triangle type
  const [w, h] = isRightAngled ? [original_h, original_h] : [Math.round(original_h * 2 / Math.sqrt(3)), Math.round(original_h * 2 / Math.sqrt(3))];
  const triangles = {
    "br": createCanvasWithImage(img, w, h),
    "tl": createCanvasWithImage(img, w, h, true)
  };

  // Set up transformation details based on triangle type
  let TRANSFORM_PREFIXES;
  if (isRightAngled) {
    const CENTER = [w / 2, h / 2];
    const STR_TRANS = `translate(0 0)`;
    TRANSFORM_PREFIXES = {
      "a": STR_TRANS,
      "b": `${STR_TRANS} rotate(90 ${CENTER[0]} ${CENTER[1]})`
    };
  } else {
    const equilateral_triangle_height = h * Math.sqrt(3) / 2;
    const flipSkew = usePrimaryDiagonal ? -1 : 1;
    const M = noWarp ? '' : `matrix(1 0 ${flipSkew * 0.5 * w / h} ${equilateral_triangle_height / h} ${-flipSkew * w / 2} ${h - equilateral_triangle_height})`;
    const CENTER = [w / 2, h - (1 / 3) * original_h];
    const STR_TRANS = `translate(0 ${-(h - equilateral_triangle_height)})`;
    TRANSFORM_PREFIXES = {
      "a": `${STR_TRANS} ${M}`,
      "b": `${STR_TRANS} rotate(-120 ${CENTER[0]} ${CENTER[1]}) ${M}`,
      "c": `${STR_TRANS} rotate(120 ${CENTER[0]} ${CENTER[1]}) ${M}`
    };
  }

  if (singleTri) {
    TRANSFORM_PREFIXES = { "": TRANSFORM_PREFIXES["a"] };
  }

  // Apply transformations to triangles
  let transformed_triangles = {};
  for (let ori in triangles) {
    for (let suffix in TRANSFORM_PREFIXES) {
      transformed_triangles[(noWarp && isRightAngled ? '' : ori + '_') + suffix] = [triangles[ori], TRANSFORM_PREFIXES[suffix]];
    }
    if (noWarp || singleTri) break;
  }

  return transformed_triangles;
}

function generateSVGContainer(bbSize, offset, h, S, costumeScaleFactor, DEBUG, numTris, noClip, isFlipped, isRightAngled, usePrimaryDiagonal, triIdx) {
  // Adjusting for scale
  bbSize *= costumeScaleFactor
  h *= costumeScaleFactor
  offset *= costumeScaleFactor;

  // Create SVG element
  const svgNS = "http://www.w3.org/2000/svg";
  const root = document.createElementNS(svgNS, "svg");
  root.setAttribute('width', `${bbSize}px`);
  root.setAttribute('height', `${bbSize}px`);
  root.setAttribute('xmlns', svgNS);
  root.setAttribute('stroke', 'none');
  root.setAttribute('viewBox', `0 0 ${bbSize} ${bbSize}`);
  root.setAttribute('version', '1.1');

  // Create transparent bounding circle
  const circleElem = document.createElementNS(svgNS, "circle");
  circleElem.setAttribute('opacity', DEBUG ? '1' : '0');
  circleElem.setAttribute('cx', '50%');
  circleElem.setAttribute('cy', '50%');
  circleElem.setAttribute('r', '50%');
  circleElem.setAttribute('fill', 'none');
  circleElem.setAttribute('stroke', DEBUG ? 'red' : 'none');
  circleElem.setAttribute('stroke-width', DEBUG ? '2px' : '0px');
  root.appendChild(circleElem);

  // Create clipping triangle (or triangles if packMult is True)
  var clipTriangles = "";

  // offset is used to scale the triangle. 
  // by scaling like this we can offset the cut edge for all orientations or splits, as the clippath takes care of it.
  for (let i = 0; i < numTris; i++) {
    let x1, y1, x2, y2, x3, y3;
    
    const hFlip = usePrimaryDiagonal ? -1 : 1;
    if (isRightAngled) {
      // Right-angled triangle points (base along the x-axis)
      x1 = bbSize / 2 + hFlip * h/2; y1 = bbSize - S * h; //bottom-right
      x2 = bbSize / 2 + hFlip * h/2; y2 = bbSize - S * h - h; // top-right
      x3 = bbSize / 2 - hFlip * h/2; y3 = bbSize - S * h; //bottom-left
    } else {
      // Equilateral triangle points with offsets applied 
      x1 = bbSize / 2 + h / Math.sqrt(3); y1 = bbSize - S * h + offset; // bottom-right
      x2 = bbSize / 2;  y2 = bbSize - S * h - h; //top
      x3 = bbSize / 2 - h / Math.sqrt(3); y3 = bbSize - S * h + offset; //bottom-left
    }

    // Apply flipping if needed
    if (isFlipped) {
      y1 = bbSize - y1 + h;
      y2 = bbSize - y2 - h;
      y3 = bbSize - y3 + h;
    }

    const isOdd = (triIdx === -1 ? i : triIdx) % 2 === 1;
    const baseRotation = isOdd && isRightAngled ? `rotate(${usePrimaryDiagonal ? -90 : 90} ${(x1+x3)/2} ${(y1+y2)/2})` : '';

    // account for cutedge offset
    if (isRightAngled) {
      const perpOff = offset * Math.sqrt(2)
      y2 -= perpOff;
      x3 -= hFlip * perpOff;
    }else{
      const perpOff = offset * Math.tan(Math.PI/3) // 1px perp to the 60 deg side, requires 1.71px on each axis.
      x1 += hFlip * perpOff
      y2 -= perpOff;
      x3 -= hFlip * perpOff;
    }
    const incrementalRotation = i === 0 ? '' : `rotate(${i * 360 / numTris} ${bbSize / 2} ${bbSize / 2})`; // for packAll
    const transform = `${incrementalRotation} ${baseRotation}`.trim();

    // Create the SVG polygon element with adjusted offsets for each point
    const clipTriangle = `<polygon transform="${transform}" fill="none" stroke="red" opacity="0.5" stroke-width="0.25px" points="${x1},${y1} ${x2},${y2} ${x3},${y3}" />`;

    clipTriangles += clipTriangle;

    // Add the debugging triangles
    if (DEBUG) {
      root.insertAdjacentHTML('beforeend', clipTriangle)
    }
  }

  // Create clipping group
  const clippingGroup = document.createElementNS(svgNS, "g");
  root.appendChild(clippingGroup);

  if (!noClip) {
    const defs = document.createElementNS(svgNS, "defs");
    const clipPathElem = document.createElementNS(svgNS, "clipPath");
    clipPathElem.setAttribute('id', `cut-to-triangles`);
    defs.appendChild(clipPathElem)
    root.appendChild(defs);
    clipPathElem.innerHTML = clipTriangles;
    clippingGroup.setAttribute('clip-path', "url(#cut-to-triangles)");
  }

  return [root, clippingGroup];
}

function generateSTTFSvgGroup(canvas_im, transform, bbSize, w, h, S, costumeScaleFactor, isFlipped, S_noOutline, h_noOutline, rotation, useOutline) {

  // Adjusting for scale
  bbSize *= costumeScaleFactor
  w *= costumeScaleFactor;
  h *= costumeScaleFactor;
  h_noOutline *= costumeScaleFactor;
  const im_width = canvas_im.width
  const im_height = canvas_im.height

  // create container for everything incase we want to pack multiple
  const svgNS = "http://www.w3.org/2000/svg";
  const mainContainer = document.createElementNS(svgNS, "g");
  if (rotation != 0) { mainContainer.setAttribute('transform', `rotate(${rotation},${bbSize / 2},${bbSize / 2})`) }

  // y position at bottom if not flipped else at top
  var yTrans = isFlipped ? S * h : bbSize - S * h - h;

  // Create image element
  const imB64 = canvas_im.toDataURL("image/png").split(',')[1];
  const imageElem = document.createElementNS(svgNS, "image");
  imageElem.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `data:image/png;base64,${imB64}`);
  imageElem.setAttribute('stroke-width', '1');
  imageElem.setAttribute('width', `${im_width}px`);
  imageElem.setAttribute('height', `${im_height}px`);
  imageElem.setAttribute('x', '0');
  imageElem.setAttribute('y', '0');
  imageElem.setAttribute('transform', `translate(${bbSize / 2 - w / 2} ${yTrans}) scale(${w / im_width} ${w / im_width}) ${transform}`);
  imageElem.setAttribute('fill', '#000000');
  imageElem.setAttribute('preserveAspectRatio', 'none');
  mainContainer.appendChild(imageElem);

  // if there is an outline, clone the image and scale it down by the the outline width. (we previously scaled up the original image to fill the outline)
  if (useOutline) {
    const scaledImageElem = imageElem.cloneNode();
    // y position at bottom if not flipped else at top
    yTrans = isFlipped ? S_noOutline * h_noOutline : bbSize - S_noOutline * h_noOutline - h_noOutline;
    const w_noOutline = h_noOutline / h * w
    scaledImageElem.setAttribute('transform', `translate(${bbSize / 2 - w_noOutline / 2} ${yTrans}) scale(${w_noOutline / im_width} ${w_noOutline / im_width}) ${transform}`);
    scaledImageElem.setAttribute('id', 'innerImage')
    mainContainer.appendChild(scaledImageElem);
  }

  return mainContainer;
}

function convertFiles(h, S, R, costumeScaleFactor, isDebug, isFlipped, outputZip, noWarp, triScaleFactor, cutEdgeOffset, outlineWidth, noClip, packAll, singleTri, usePrimaryDiagonal, isRightAngled, isBitmap) {
  // Some values don't apply to bitmap and need to be set back to default
  if(isBitmap){
    costumeScaleFactor = 1.0;
    outlineWidth = 0;
    triscalefactor = 1.0;
  }

  document.getElementById('downloadLinks').innerHTML = ''
  const fileSelector = document.getElementById('source');
  const files = fileSelector.files;

  // Check if no file is selected
  if (files.length === 0) {
    alert("No file selected. Please choose a file before converting.");
    return; // Exit the function if no file is selected
  }

  // calculate bbsize before triangle is scaled
  const bbSize = h * R;

  // we are going to account for the outline by initially overscaling the triangle
  // later we'll stamp a second image ontop if the outline width isn't 0, this image will be scaled down back to the original triangle scale
  const outlineScale = 1 + 2 * outlineWidth / h;
  triScaleFactor = triScaleFactor * outlineScale;

  // scale triangle by triangle scale factor in a very questionable but quick to implement way
  const h_scaled = h * triScaleFactor;

  // we calculate h and S as if we hadn't scaled it by outlineScale, so we can add our original triangle ontop
  h_noOutline = h_scaled / outlineScale;
  S_noOutline = (S - (triScaleFactor / outlineScale - 1) / 2) * (h / h_noOutline);

  S = (S - (triScaleFactor - 1) / 2) * (h / h_scaled);
  h = h_scaled;
  w = isRightAngled ? h : h * 2 / Math.sqrt(3)

  const numTrisOnPack = packAll ? files.length * (noWarp ? 1 : 2) * (singleTri ? 1 : (isRightAngled ? 2 : 3)) : 1;
  var [svgRoot, clippingGroup] = generateSVGContainer(bbSize, cutEdgeOffset, h, S, costumeScaleFactor, isDebug, numTrisOnPack, noClip, isFlipped, isRightAngled, usePrimaryDiagonal, -1);
  var packIdx = 0;

  for (let i = 0; i < files.length; i++) {

    const file = files[i];
    const filename = file.name.split('.').slice(0, -1).join('.');
    const ext = file.name.split('.').pop();

    if (!["png", "jpg", "jpeg"].includes(ext.toLowerCase())) {
      alert("Image must be in PNG or JPEG format");
      continue;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const tris = generateSTTFFromImage(img, h, noWarp, singleTri, usePrimaryDiagonal, isRightAngled);
        const svgStrings = []
        Object.entries(tris).forEach(([ori, tri], triIdx) => {
          if (!packAll) { [svgRoot, clippingGroup] = generateSVGContainer(bbSize, cutEdgeOffset, h, S, costumeScaleFactor, isDebug, numTrisOnPack, noClip, isFlipped, isRightAngled, usePrimaryDiagonal, triIdx); }
          
          const sttfGroup = generateSTTFSvgGroup(
            tri[0], tri[1], bbSize, w , h, S, costumeScaleFactor, isFlipped, S_noOutline, h_noOutline, packIdx * 360 / numTrisOnPack, outlineWidth > 0
          );

          clippingGroup.appendChild(sttfGroup)

          if (!packAll || (packIdx == numTrisOnPack-1)) {
            svgString = new XMLSerializer().serializeToString(svgRoot)
            svgStrings.push([svgString, `${filename}_${ori}.svg`]);
          }

          packIdx += 1;
        });
        if (svgStrings.length>0) generateDownloadLink(svgStrings, outputZip, filename, isBitmap, bbSize);
      }
      img.src = e.target.result;
    }
    reader.readAsDataURL(file);
  }
} 