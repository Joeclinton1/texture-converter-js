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


function generateSTTFFromImage(img, original_h, noWarp) {
    const [w, h] = [Math.round(original_h * 2 / Math.sqrt(3)), Math.round(original_h * 2 / Math.sqrt(3))];

    const triangles = {
        "br": createCanvasWithImage(img, w, h),
        "tl": createCanvasWithImage(img, w, h, true)
    };

    // Equilateral triangle affine transformation
    const equilateral_triangle_height = h * Math.sqrt(3) / 2;
    M = `matrix(1 0 ${0.5 * w / h} ${equilateral_triangle_height / h} ${-w / 2} ${h - equilateral_triangle_height})`;
    if(noWarp){
        M=''
    }
    // Transformation prefix for each triangle orientation
    const CENTER = [w / 2, h - (1 / 3) * original_h];
    const STR_TRANS = `translate(0 ${-(h - equilateral_triangle_height)})`;
    const TRANSFORM_PREFIXES = {
        "_a": `${STR_TRANS} ${M}`,
        "_b": `${STR_TRANS} rotate(-120 ${CENTER[0]} ${CENTER[1]}) ${M}`,
        "_c": `${STR_TRANS} rotate(120 ${CENTER[0]} ${CENTER[1]})${M}`
    };

    // Generate the transformed triangles dictionary
    let transformed_triangles = {};
    for (let ori in triangles) {
        for (let suffix in TRANSFORM_PREFIXES) {
            transformed_triangles[ori + suffix] = [triangles[ori], TRANSFORM_PREFIXES[suffix]];
        }
    }

    return transformed_triangles;
}

function generateSTTFSvg(canvas_im, transform, bbSize, w, h, S, scaleFactor, DEBUG, isFlipped, offset) {

    // Adjusting for scale
    bbSize*=scaleFactor
    w *= scaleFactor;
    h *= scaleFactor;
    offset *= scaleFactor;
    const im_width = canvas_im.width
    const im_height = canvas_im.height

    // Create SVG element
    const svgNS = "http://www.w3.org/2000/svg";
    const root = document.createElementNS(svgNS, "svg");
    root.setAttribute('width', `${bbSize}px`);
    root.setAttribute('height', `${bbSize}px`);
    root.setAttribute('xmlns', svgNS);
    root.setAttribute('stroke', 'none');
    root.setAttribute('viewBox', `0 0 ${bbSize} ${bbSize}`);
    root.setAttribute('version', '1.1');

    // Create group for clipping
    const clippingGroup = document.createElementNS(svgNS, "g");
    clippingGroup.setAttribute('clip-path', "url(#cut-to-triangle)");
    root.appendChild(clippingGroup);

    // y position at bottom if not flipped else at top
    const yTrans = isFlipped ? S * h : bbSize - S * h - h;

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
    clippingGroup.appendChild(imageElem);

    // Create transparent bounding circle
    const circleElem = document.createElementNS(svgNS, "circle");
    circleElem.setAttribute('opacity', DEBUG ? '1' : '0');
    circleElem.setAttribute('cx', '50%');
    circleElem.setAttribute('cy', '50%');
    circleElem.setAttribute('r', '50%');
    circleElem.setAttribute('fill', 'none');
    circleElem.setAttribute('stroke', DEBUG ? 'red' : 'none');
    circleElem.setAttribute('stroke-width',  DEBUG ? '2px' : '0px');
    root.appendChild(circleElem);

    // Create triangle for clipping
    const x1 = bbSize / 2;
    const y1 = bbSize - S * h - h;
    const x2 = bbSize / 2 + h / Math.sqrt(3);
    const y2 = bbSize - S * h;
    const x3 = bbSize / 2 - h / Math.sqrt(3);
    const y3 = bbSize - S * h;
    const clipTriangle = `<polygon fill="none" stroke="red" opacity="0.5" stroke-width="0.25px" points="${x1},${y1 - offset * Math.tan(Math.PI / 3)} ${x2 + offset * Math.tan(Math.PI / 3)},${y2 + offset} ${x3 - offset * Math.tan(Math.PI / 3)},${y3 + offset}" />`;
    const clipPathElem = document.createElementNS(svgNS, "clipPath");
    clipPathElem.setAttribute('id', 'cut-to-triangle');
    clipPathElem.innerHTML = clipTriangle;
    const defs = document.createElementNS(svgNS, "defs");
    defs.appendChild(clipPathElem);
    root.appendChild(defs);

    // For debugging
    if (DEBUG) {
        const debugTriangleElem = document.createElementNS(svgNS, "polygon");
        debugTriangleElem.setAttribute('fill', 'none');
        debugTriangleElem.setAttribute('stroke', 'red');
        debugTriangleElem.setAttribute('opacity', '0.5');
        debugTriangleElem.setAttribute('stroke-width', '1px');
        debugTriangleElem.setAttribute('points', `${x1},${y1} ${x2},${y2} ${x3},${y3}`);
        // root.appendChild(debugTriangleElem);
        root.insertAdjacentHTML('beforeend', clipTriangle)
    }

    // Convert SVG element to string and save to file (or handle accordingly in a web context)
    return new XMLSerializer().serializeToString(root)
}

function convertFiles(h, S, R, costumeScaleFactor, isDebug, isFlipped, outputZip, noWarp, triScaleFactor, cutEdgeOffset) {
    document.getElementById('downloadLinks').innerHTML = ''
    const fileSelector = document.getElementById('source');
    const files = fileSelector.files;

    // calculate bbsize before triangle is scaled
    const bbSize = h*R

    // scale triangle by triangle scale factor in a very questionable but quick to implement way
    const h_scaled = h*triScaleFactor
    S=(S-(triScaleFactor-1)/2)*(h/h_scaled)
    h=h_scaled
    
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
                const tris = generateSTTFFromImage(img, h, noWarp);
                const svgStrings = Object.entries(tris).map(([ori, tri]) => {
                    const svgString = generateSTTFSvg(
                        tri[0],
                        tri[1],
                        bbSize,
                        h * 2 / Math.sqrt(3),
                        h,
                        S,
                        costumeScaleFactor,
                        isDebug,
                        isFlipped,
                        cutEdgeOffset
                    );
                    return [svgString, `${filename}_${ori}.svg`];
                });

                generateDownloadLink(svgStrings, outputZip, filename)
            };
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
} 