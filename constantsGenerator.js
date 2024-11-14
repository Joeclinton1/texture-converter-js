function generateConstants(S, R, h, costume_scale, triangleShape) {
  let consts = [];

  switch (triangleShape) {
    case "rightAngled":
      var constP1_x = 1/(2*R);
      var constP1_y = -0.5 + S / R;
      var constP1_r = Math.sqrt(constP1_x * constP1_x + constP1_y * constP1_y);
      var constP2_y = 1/R + constP1_y
      var constP2_r = Math.sqrt(constP1_x * constP1_x + constP2_y * constP2_y);

      consts.push(constP1_y / (-2 * constP1_x)); // r1/base_length
      consts.push((h * costume_scale * R * constP1_x) / constP1_r / 100); // h*R*P1_x/P1_r/100
      consts.push(-180/Math.PI*(180*(constP2_y>=0) - Math.atan(constP1_x/constP2_y))); // -deg(atan2(P2_y, P2_x))
      consts.push(-1*(consts[consts.length-1])); //deg(atan2(P2_y, P2_x))
      consts.push(Math.log(constP2_r / constP1_r) * 200); // ln(2*PI*P1_r/100)*200
      consts.push(Math.log(2 * constP1_r) * 100); // ln(2*PI*P1_r)*100
      consts.push(Math.log(2 * constP2_r) * 100); // ln(2*PI*P2_r)*100
      break;

    default:
      var constP1_x = (1 / Math.sqrt(3)) / R;
      var constP1_y = -0.5 + S / R;
      var constP1_r = Math.sqrt(constP1_x * constP1_x + constP1_y * constP1_y);
      var constP2_r = -1 * constP1_y - 1 / R;

      consts.push(constP1_y / (-2 * constP1_x)); // r1/base_length
      consts.push((h * costume_scale * R * constP1_x) / constP1_r / 100); // h*R*P1_x/P1_r/100
      consts.push(Math.log(constP2_r / constP1_r) * 200); // ln(2*PI*P1_r/100)*200
      consts.push(Math.log(2 * constP1_r) * 100); // ln(2*PI*P1_r)*100
      consts.push(Math.log(2 * constP2_r) * 100); // ln(2*PI*P2_r)*100
  }

  return consts;
}

function updateConstantsOnInputChange(_) {
  const height = document.getElementById("height").value;
  const ratio = document.getElementById("ratio").value;
  const displacement = document.getElementById("displacement").value;
  const costumeScaleFactor = document.getElementById("bitmap").checked ? 1 : document.getElementById("costumescalefactor").value;
  const triangleShape = document.querySelector('input[name="triangleType"]:checked').id

  const constantsElement = document.getElementById("constants")
  constantsElement.innerHTML = ''
  constants = generateConstants(displacement, ratio, height, costumeScaleFactor, triangleShape)
  for (let constant of constants) {
    constantsElement.insertAdjacentHTML('beforeend', `<li class="list-group-item"><span class="text-primary">${constant}</span></li>`);
  }
}
