import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3, vec4} from "../node_modules/gl-matrix/esm/index.js";

// *********************************************************************************************************************
// **                                                                                                                 **
// **                  This is an example of simplistic forward rendering technique using WebGL                       **
// **                                                                                                                 **
// *********************************************************************************************************************

// ******************************************************
// **                       Data                       **
// ******************************************************

//         -.5 .5 -.5  +--------------+ .5 .5 -.5
//                    /|             /|
//                   / |            / |
//      -.5 .5 .5   *--+-----------*  | .5 .5 .5
//                  |  |           |  |
//                  |  |           |  |
//                  |  |           |  |
//     -.5 -.5 -.5  |  +-----------+--+ .5 -.5 -.5
//                  | /            | /
//                  |/             |/
//     -.5 -.5 .5   *--------------*  .5 -.5 .5

import {positions, uvs, indices} from "../blender/cube.js";
import {positions as planePositions, indices as planeIndices} from "../blender/plane.js";

// ******************************************************
// **               Geometry processing                **
// ******************************************************

// language=GLSL
let vertexShader = `
    #version 300 es
    
    uniform float time;
    uniform vec4 bgColor;
    uniform vec4 fgColor;
    uniform mat4 modelViewMatrix;
    uniform mat4 modelViewProjectionMatrix;
    
    layout(location=0) in vec3 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    
    out vec4 color;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);
        vec3 viewNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;
        color = mix(bgColor * 0.8, fgColor, viewNormal.z) + pow(viewNormal.z, 20.0);
        v_uv = uv;
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
      vec4 t = viewProjectionInverse * v_position;
      outColor = texture(cubemap, normalize(t.xyz / t.w));
    }
`;

let skyboxVertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    out vec4 v_position;
    
    void main() {
      v_position = vec4(position.xz, 1.0, 1.0);
      gl_Position = v_position;
    }
`;

// ******************************************************
// **                 Pixel processing                 **
// ******************************************************

// language=GLSL
let fragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D tex;    
    
    in vec2 v_uv;
    
    out vec4 outColor;
    
    void main()
    {        
        outColor = texture(tex, v_uv);
    }
`;

// ******************************************************
// **             Application processing               **
// ******************************************************

let bgColor = vec4.fromValues(1.0, 0.2, 0.3, 1.0);
let fgColor = vec4.fromValues(1.0, 0.9, 0.5, 1.0);


app.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3])
    .enable(PicoGL.DEPTH_TEST)
    .enable(PicoGL.CULL_FACE);

let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());
let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let skyboxViewProjectionInverse = mat4.create();

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}

    const tex = await loadTexture("abstract.jpg");
    let drawCall = app.createDrawCall(program, vertexArray)
        .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
            magFilter: PicoGL.LINEAR,
            minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
            maxAnisotropy: 10,
            wrapS: PicoGL.REPEAT,
            wrapT: PicoGL.REPEAT
            .uniform("bgColor", bgColor)
            .uniform("fgColor", fgColor)
        }));


    let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", app.createCubemap({
        negX: await loadTexture("stormydays_bk.png"),
        posX: await loadTexture("stormydays_ft.png"),
        negY: await loadTexture("stormydays_dn.png"),
        posY: await loadTexture("stormydays_up.png"),
        negZ: await loadTexture("stormydays_lf.png"),
        posZ: await loadTexture("stormydays_rt.png")
    }));

    function draw(timems) {
        const time = timems * 0.001;
    
        mat4.perspective(projMatrix, Math.PI / 2, app.width / app.height, 0.1, 100.0);
        let camPos = vec3.rotateY(vec3.create(), vec3.fromValues(0, 0.5, 2), vec3.fromValues(0, 0, 0), time * 0.05);
        mat4.lookAt(viewMatrix, camPos, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
        mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);
    
        mat4.fromXRotation(rotateXMatrix, time * 0.1136);
        mat4.fromZRotation(rotateYMatrix, time * 0.2235);
        mat4.multiply(modelMatrix, rotateXMatrix, rotateYMatrix);
    
        mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
        mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    
        let skyboxViewProjectionMatrix = mat4.create();
        mat4.mul(skyboxViewProjectionMatrix, projMatrix, viewMatrix);
        mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);
    
        app.clear();
    
        app.disable(PicoGL.DEPTH_TEST);
        app.disable(PicoGL.CULL_FACE);
        skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
        skyboxDrawCall.draw();
    
        app.enable(PicoGL.DEPTH_TEST);
        app.enable(PicoGL.CULL_FACE);
        drawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
        drawCall.draw();
    
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);