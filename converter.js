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


function generateDownloadLink(svgStrings, outputZip, filename) {
    if (outputZip) {
        const zip = new JSZip();
        svgStrings.forEach(([svgData, filename]) => zip.file(filename, svgData));

        zip.generateAsync({ type: "blob" })
            .then(blob => addLinkToContainer(URL.createObjectURL(blob), `${filename}.zip`, 'Download ZIP'));

    } else {
        svgStrings.forEach(([svgData, filename]) => {
            const blobURL = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
            addLinkToContainer(blobURL, filename, filename);
        });
    }

    document.getElementById('downloadContainer').style.display = 'block';
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


function generateSTTFFromImage(img, original_h, noWarp, singleTri) {
    const [w, h] = [Math.round(original_h * 2 / Math.sqrt(3)), Math.round(original_h * 2 / Math.sqrt(3))];

    const triangles = {
        "br": createCanvasWithImage(img, w, h),
        "tl": createCanvasWithImage(img, w, h, true)
    };

    // Equilateral triangle affine transformation
    const equilateral_triangle_height = h * Math.sqrt(3) / 2;
    M = `matrix(1 0 ${0.5 * w / h} ${equilateral_triangle_height / h} ${-w / 2} ${h - equilateral_triangle_height})`;
    if (noWarp) {
        M = ''
    }
    // Transformation prefix for each triangle orientation
    const CENTER = [w / 2, h - (1 / 3) * original_h];
    const STR_TRANS = `translate(0 ${-(h - equilateral_triangle_height)})`;
    var TRANSFORM_PREFIXES = {
        "a": `${STR_TRANS} ${M}`,
        "b": `${STR_TRANS} rotate(-120 ${CENTER[0]} ${CENTER[1]}) ${M}`,
        "c": `${STR_TRANS} rotate(120 ${CENTER[0]} ${CENTER[1]})${M}`
    };
    if (singleTri) { TRANSFORM_PREFIXES = { "": TRANSFORM_PREFIXES["a"] } }

    // Generate the transformed triangles dictionary
    let transformed_triangles = {};
    for (let ori in triangles) {
        for (let suffix in TRANSFORM_PREFIXES) {
            transformed_triangles[(noWarp ? '' : ori + '_') + suffix] = [triangles[ori], TRANSFORM_PREFIXES[suffix]];
        }
        if (noWarp) { break; }
    }

    return transformed_triangles;
}

function generateSVGContainer(bbSize,offset, h, S, costumeScaleFactor, DEBUG, numTris, noClip, isFlipped, clipPathShape) {
    // Adjusting for scale
    bbSize *= costumeScaleFactor
    h*= costumeScaleFactor
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
    
    for (let i = 0; i < numTris; i++) {
        const transform = i==0 ? '' : `transform="rotate(${i * 360 / numTris} ${bbSize / 2} ${bbSize / 2})"`;
        if(clipPathShape == 0){
            const x1 = bbSize / 2;
            var y1 = bbSize - S * h - h;
            const x2 = bbSize / 2 + h / Math.sqrt(3);
            var y2 = bbSize - S * h;
            const x3 = bbSize / 2 - h / Math.sqrt(3);
            var y3 = bbSize - S * h;
            if (isFlipped) {
                y1 = bbSize - y1 - h
                y2 = bbSize - y2 + h
                y3 = bbSize - y3 + h
            }
            const clipTriangle = `<polygon ${transform} fill="none" stroke="red" opacity="0.5" stroke-width="0.25px" points="${x1},${y1 - offset * Math.tan(Math.PI / 3)} ${x2 + offset * Math.tan(Math.PI / 3)},${y2 + offset} ${x3 - offset * Math.tan(Math.PI / 3)},${y3 + offset}" />`;
        }else{
            const x1 = bbSize / 2;
            var y1 = bbSize - S * h - h;
            const x2 = bbSize / 2 + h / Math.sqrt(3);
            var y2 = bbSize - S * h;
            const x3 = bbSize / 2 - h / Math.sqrt(3);
            var y3 = bbSize - S * h;
            if (isFlipped) {
                y1 = bbSize - y1 - h
                y2 = bbSize - y2 + h
                y3 = bbSize - y3 + h
            }
            const clipTriangle = `<polygon ${transform} fill="none" stroke="red" opacity="0.5" stroke-width="0.25px" points="${x1},${y1 - offset * Math.tan(Math.PI / 3)} ${x2 + offset * Math.tan(Math.PI / 3)},${y2 + offset} ${x3 - offset * Math.tan(Math.PI / 3)},${y3 + offset}" />`;
        }
       
        clipTriangles += clipTriangle

        // Add the debugging triangles
        if (DEBUG) {
            root.insertAdjacentHTML('beforeend', clipTriangle)
        }
    }

    // Create clipping group
    const clippingGroup = document.createElementNS(svgNS, "g");
    root.appendChild(clippingGroup);

    if(!noClip){
        const defs = document.createElementNS(svgNS, "defs");
        const clipPathElem = document.createElementNS(svgNS, "clipPath");
        clipPathElem.setAttribute('id', `cut-to-triangles`);
        defs.appendChild(clipPathElem)
        root.appendChild(defs);
        clipPathElem.innerHTML = clipTriangles;
        clippingGroup.setAttribute('clip-path',"url(#cut-to-triangles)");
    }

    return [root, clippingGroup];
}

function generateSTTFSvgGroup(canvas_im, transform, bbSize, w, h, S, costumeScaleFactor, isFlipped, offset, S_noOutline, h_noOutline, rotation) {

    // Adjusting for scale
    bbSize *= costumeScaleFactor
    w *= costumeScaleFactor;
    h *= costumeScaleFactor;
    h_noOutline *= costumeScaleFactor;
    offset *= costumeScaleFactor;
    const im_width = canvas_im.width
    const im_height = canvas_im.height

    // create container for everything incase we want to pack multiple
    const svgNS = "http://www.w3.org/2000/svg";
    const mainContainer = document.createElementNS(svgNS, "g");
    if(rotation!=0){mainContainer.setAttribute('transform', `rotate(${rotation},${bbSize / 2},${bbSize / 2})`)}

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
    if (true) {
        const scaledImageElem = imageElem.cloneNode();
        // y position at bottom if not flipped else at top
        yTrans = isFlipped ? S_noOutline * h_noOutline : bbSize - S_noOutline * h_noOutline - h_noOutline;
        const w_noOutline = h_noOutline * 2 / Math.sqrt(3)
        scaledImageElem.setAttribute('transform', `translate(${bbSize / 2 - w_noOutline / 2} ${yTrans}) scale(${w_noOutline / im_width} ${w_noOutline / im_width}) ${transform}`);
        scaledImageElem.setAttribute('id', 'innerImage')
        mainContainer.appendChild(scaledImageElem);
    }

    return mainContainer;
}

function convertFiles(h, S, R, costumeScaleFactor, isDebug, isFlipped, outputZip, noWarp, triScaleFactor, cutEdgeOffset, outlineWidth, noClip, packAll, singleTri, clipPathShape) {
    document.getElementById('downloadLinks').innerHTML = ''
    const fileSelector = document.getElementById('source');
    const files = fileSelector.files;

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

    const numTrisOnPack = packAll ? files.length * (noWarp ? 1 : 2) * (singleTri ? 1 : 3) : 1;
    var [svgRoot, clippingGroup] = generateSVGContainer(bbSize, cutEdgeOffset, h, S, costumeScaleFactor, isDebug, numTrisOnPack, noClip, isFlipped);
    var packIdx = 0;    

    for (let i = 0; i < files.length; i++) {

        const file = files[i];
        const filename = file.name.split('.').slice(0, -1).join('.');
        const ext = file.name.split('.').pop();

        if (ext.toLowerCase() !== "png") {
            alert("Image must be in PNG format");
            continue;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const tris = generateSTTFFromImage(img, h, noWarp, singleTri);
                const svgStrings = []
                Object.entries(tris).forEach(([ori, tri]) => {
                    if (!packAll) { [svgRoot, clippingGroup] = generateSVGContainer(bbSize,  cutEdgeOffset, h, S, costumeScaleFactor, isDebug, numTrisOnPack, noClip, isFlipped); }

                    const sttfGroup = generateSTTFSvgGroup(
                        tri[0],
                        tri[1],
                        bbSize,
                        h * 2 / Math.sqrt(3),
                        h,
                        S,
                        costumeScaleFactor,
                        isFlipped,
                        cutEdgeOffset,
                        S_noOutline,
                        h_noOutline,
                        packIdx * 360 / numTrisOnPack
                    );

                    clippingGroup.appendChild(sttfGroup)

                    if (!packAll) {
                        svgString = new XMLSerializer().serializeToString(svgRoot)
                        svgStrings.push([svgString, `${filename}_${ori}.svg`]);
                    }

                    packIdx += 1;
                });
                if (!packAll) { generateDownloadLink(svgStrings, outputZip, filename) } else
                    if (i == files.length - 1) {
                        svgString = new XMLSerializer().serializeToString(svgRoot);
                        generateDownloadLink([[svgString, "packed_STTF_texture.svg"]], outputZip, "packed_STTF_texture");
                    }
            };
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
} 