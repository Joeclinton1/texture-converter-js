function generateConstants(S, R, h, costume_scale) {
    // Initialize an array to store the constants
    let consts = [];

    // Calculate constants based on the provided formulas
    const constP1_x = (1 / Math.sqrt(3)) / R;
    const constP1_y = -0.5 + S / R;
    const constP1_r = Math.sqrt(constP1_x * constP1_x + constP1_y * constP1_y);
    const constP2_r = -1 * constP1_y - 1 / R;

    // Push calculated values to the consts array
    consts.push(constP1_y / (-2 * constP1_x)); // r1/base_length
    consts.push((h * costume_scale * R * constP1_x) / constP1_r / 100); // h*R*P1_x/P1_r/100
    consts.push(Math.log(constP2_r/ constP1_r) * 200); // ln(2*PI*P1_r/100)*200
    consts.push(Math.log(2 * constP1_r) * 100); // ln(2*PI*P1_r)*100
    consts.push(Math.log(2 * constP2_r) * 100); // ln(2*PI*P2_r)*100

    // Return the array of constants
    return consts;
}

function onInputChange(_) {
    const height = document.getElementById("height").value;
    const ratio = document.getElementById("ratio").value;
    const displacement = document.getElementById("displacement").value;
    const costumeScaleFactor = document.getElementById("costumescalefactor").value;

    const constantsElement = document.getElementById("constants")
    constantsElement.innerHTML = ''
    constants = generateConstants(displacement, ratio, height, costumeScaleFactor)
    for (let constant of constants){
        constantsElement.insertAdjacentHTML('beforeend', `<li class="list-group-item"><span class="text-primary">${constant}</span></li>`);
    }
}
