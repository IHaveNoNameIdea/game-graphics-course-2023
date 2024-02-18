// Shadow mapping demo

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3, vec4, quat} from "../node_modules/gl-matrix/esm/index.js";

import {positions, normals, indices} from "../blender/ship1.js";
import {positions as planePositions, indices as planeIndices} from "../blender/plane.js";

// language=GLSL
let fragmentShader = `
    #version 300 es    
    precision highp float;    
    precision highp sampler2DShadow;
    
    uniform vec4 baseColor;
    uniform vec4 ambientColor;
    uniform vec3 lightPosition;
    uniform vec3 cameraPosition;    
    uniform sampler2DShadow shadowMap;
    
    in vec3 vPosition;
    in vec3 vNormal;
    in vec4 vPositionFromLight;
    in vec3 vModelPosition;
    out vec4 fragColor;
    
    void main() {
        vec3 shadowCoord = (vPositionFromLight.xyz / vPositionFromLight.w) / 2.0 + 0.5;        
        float shadow = texture(shadowMap, shadowCoord);
        
        vec3 normal = normalize(vNormal);
        vec3 eyeDirection = normalize(cameraPosition - vPosition);
        vec3 lightDirection = normalize(lightPosition - vPosition);        
        vec3 reflectionDirection = reflect(-lightDirection, normal);
        
        float diffuse = max(dot(lightDirection, normal), 0.0) * max(shadow, 0.2);        
        float specular = shadow * pow(max(dot(reflectionDirection, eyeDirection), 0.0), 100.0) * 0.7;
        fragColor = vec4(diffuse * baseColor.rgb + ambientColor.rgb + specular, baseColor.a);
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
    
    uniform mat4 modelMatrix;
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 lightModelViewProjectionMatrix;
    
    out vec3 vPosition;
    out vec3 vNormal;
    out vec4 vPositionFromLight;
    out vec3 vModelPosition;
    
    void main() {
        gl_Position = modelViewProjectionMatrix * position;
        vModelPosition = vec3(position);
        vPosition = vec3(modelMatrix * position);
        vNormal = vec3(modelMatrix * vec4(normal, 0.0));
        vPositionFromLight = lightModelViewProjectionMatrix * position;
    }
`;

let skyboxFragmentShader = `
    #version 300 es
    precision mediump float;

    uniform samplerCube cubemap;
    uniform mat4 viewProjectionInverse;
    in vec4 v_position;

    out vec4 outColor;

    void main() {
      vec4 t = viewProjectionInverse * vec4(v_position.xyz, 0.0);
      outColor = texture(cubemap, normalize(t.xyz));
    }
`;

// language=GLSL
let skyboxVertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    out vec4 v_position;
    
    void main() {
        v_position = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    }
    
`;

// language=GLSL
let shadowFragmentShader = `
    #version 300 es
    precision highp float;
    
    out vec4 fragColor;
    
    void main() {
        // Uncomment to see the depth buffer of the shadow map    
        //fragColor = vec4((gl_FragCoord.z - 0.98) * 50.0);    
    }
`;

// language=GLSL
let shadowVertexShader = `
    #version 300 es
    layout(location=0) in vec4 position;
    uniform mat4 lightModelViewProjectionMatrix;
    
    void main() {
        gl_Position = lightModelViewProjectionMatrix * position;
    }
`;

let bgColor = vec4.fromValues(1.0, 0.2, 0.3, 1.0);
let fgColor = vec4.fromValues(1.0, 0.9, 0.5, 1.0);

app.enable(PicoGL.DEPTH_TEST)
   .enable(PicoGL.CULL_FACE)
//   .clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

let program = app.createProgram(vertexShader, fragmentShader);
let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());
let shadowProgram = app.createProgram(shadowVertexShader, shadowFragmentShader);

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));


let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));


// Change the shadow texture resolution to checkout the difference
let shadowDepthTarget = app.createTexture2D(512, 512, {
    internalFormat: PicoGL.DEPTH_COMPONENT16,
    compareMode: PicoGL.COMPARE_REF_TO_TEXTURE,
    magFilter: PicoGL.LINEAR,
    minFilter: PicoGL.LINEAR,
    wrapS: PicoGL.CLAMP_TO_EDGE,
    wrapT: PicoGL.CLAMP_TO_EDGE
});
let shadowBuffer = app.createFramebuffer().depthTarget(shadowDepthTarget);

let time = 0;
let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let rotation = quat.create();
let lightModelViewProjectionMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();

let cameraPosition = vec3.create();
let lightPosition = vec3.create();
let lightViewMatrix = mat4.create();
let lightViewProjMatrix = mat4.create();

let drawCall = app.createDrawCall(program, vertexArray)
    .uniform("baseColor", fgColor)
    .uniform("ambientColor", vec4.scale(vec4.create(), bgColor, 0.7))
    .uniform("modelMatrix", modelMatrix)
    .uniform("modelViewProjectionMatrix", modelViewProjectionMatrix)
    .uniform("cameraPosition", cameraPosition)
    .uniform("lightPosition", lightPosition)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix)
    .texture("shadowMap", shadowDepthTarget);

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture("space_bk.png"),
        posX: await loadTexture("space_ft.png"),
        negY: await loadTexture("space_dn.png"),
        posY: await loadTexture("space_up.png"),
        negZ: await loadTexture("space_lf.png"),
        posZ: await loadTexture("space_rt.png")
    }));

let shadowDrawCall = app.createDrawCall(shadowProgram, vertexArray)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix);

function renderShadowMap() {
    app.drawFramebuffer(shadowBuffer);
    app.viewport(0, 0, shadowDepthTarget.width, shadowDepthTarget.height);
    app.gl.cullFace(app.gl.FRONT);

    // Projection and view matrices are changed to render objects from the point view of light source
    mat4.perspective(projMatrix, Math.PI * 0.1, shadowDepthTarget.width / shadowDepthTarget.height, 0.1, 100.0);
    mat4.multiply(lightViewProjMatrix, projMatrix, lightViewMatrix);

    drawObjects(shadowDrawCall);

    app.gl.cullFace(app.gl.BACK);
    app.defaultDrawFramebuffer();
    app.defaultViewport();
}

function drawObjects(dc) {
    app.clear();

    // Middle object - Moves up and down
    let middleBoxMovement = Math.sin(time) * 0.5;
    quat.fromEuler(rotation, time * 80, time * 56.97, 0);
    // Initial rotation of 90 degrees around the Y-axis
    let initialRotation = quat.create();
    quat.fromEuler(initialRotation, 90, 0, 0); // 0 degrees around X, 90 degrees around Y, 0 degrees around Z
    let initialRotationMatrix = mat4.create();
    mat4.fromQuat(initialRotationMatrix, initialRotation);
    // Apply initial rotation before other transformations
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(0, middleBoxMovement, 0), [0.8, 0.8, 0.8]);
    mat4.multiply(modelMatrix, initialRotationMatrix, modelMatrix); // Apply the initial rotation
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
    dc.draw();

 //   // Small object - Moves in a circle
 //   let smallBoxAngle = time * 10; // Faster circular movement
 //   let smallBoxRadius = 0.8; // Smaller radius for tighter circle
 //   let smallBoxX = Math.cos(smallBoxAngle) * smallBoxRadius + 0.9;
 //   let smallBoxZ = Math.sin(smallBoxAngle) * smallBoxRadius + 0.6;
 //   quat.fromEuler(rotation, time * 25, time * 17, 0);
 //   mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(smallBoxX, 0.9, smallBoxZ), [0.22, 0.22, 0.22]);
 //   mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
 //   mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);
 //   dc.draw();
}


function draw(timems) {
    const time = timems * 0.001; // Use for dynamic elements

    // Perspective and camera setup from the second snippet with slight modifications for dynamic camera positioning
    vec3.set(cameraPosition, Math.sin(time * 0.05) * 7, 6, Math.cos(time * 0.05) * 6);
    mat4.perspective(projMatrix, Math.PI / 2.5, app.width / app.height, 0.1, 100.0);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(0, -1, 0), vec3.fromValues(0, 3, 0));
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    // Light position and shadow mapping from the second snippet
    vec3.set(lightPosition, 5, 5, 3.5);
    mat4.lookAt(lightViewMatrix, lightPosition, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
    renderShadowMap();

    // Combined model transformations from the first snippet
    mat4.fromXRotation(rotateXMatrix, time * 0.1136);
    mat4.fromZRotation(rotateYMatrix, time * 0.2235);
    mat4.multiply(modelMatrix, rotateXMatrix, rotateYMatrix);

    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    let skyboxViewMatrix = mat4.clone(viewMatrix);
    skyboxViewMatrix[12] = 0; // Reset the translation component of the view matrix
    skyboxViewMatrix[13] = 0;
    skyboxViewMatrix[14] = 0;

    let skyboxViewProjectionMatrix = mat4.create();
    mat4.mul(skyboxViewProjectionMatrix, projMatrix, mat4.lookAt(mat4.create(), cameraPosition, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0)));
    mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

    app.clear();

    app.depthMask(false);
    gl.depthFunc(gl.LEQUAL);
    app.enable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();
    app.depthMask(true);

    // Draw objects with shadows
    app.enable(PicoGL.DEPTH_TEST);
    app.enable(PicoGL.CULL_FACE);
    drawObjects(drawCall); // Assuming drawObjects() handles drawing with the shadow map

    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);