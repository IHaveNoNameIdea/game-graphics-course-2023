import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3} from "../node_modules/gl-matrix/esm/index.js";
import {positions, normals, uvs, indices} from "../blender/cube.js"; // Assume normals are also exported
import {positions as planePositions, indices as planeIndices} from "../blender/plane.js";

// Assuming a WebGL canvas exists with the id 'canvas-webgl'
const canvas = document.getElementById('canvas-webgl');
const app = PicoGL.createApp(canvas)
    .clearColor(0.0, 0.0, 0.0, 1.0)
    .enable(PicoGL.DEPTH_TEST)
    .enable(PicoGL.CULL_FACE);

// Vertex Shader
let vertexShader = `...`;

// Fragment Shader
let fragmentShader = `...`;

// Skybox Vertex Shader
let skyboxVertexShader = `...`;

// Skybox Fragment Shader
let skyboxFragmentShader = `...`;

let program = app.createProgram(vertexShader.trim(), fragmentShader.trim());

// Fix: Removed the semicolon that was mistakenly placed here.
let skyboxProgram = app.createProgram(skyboxVertexShader.trim(), skyboxFragmentShader.trim());

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals)) // Assuming normals data is available
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices));

let bgColor = vec4.fromValues(1.0, 0.2, 0.3, 1.0);
let fgColor = vec4.fromValues(1.0, 0.9, 0.5, 1.0);

// Matrices and vectors initialization
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
    let image = await createImageBitmap(await (await fetch("../images/" + fileName)).blob());
    return app.createTexture2D(image, image.width, image.height);
}

async function setupTextures() {
    // Load texture and setup draw calls here to ensure textures are loaded
    const tex = await loadTexture("abstract.jpg");

    let drawCall = app.createDrawCall(program, vertexArray)
        .texture("tex", tex)
        .uniform("bgColor", bgColor)
        .uniform("fgColor", fgColor);

    let cubemap = app.createCubemap({
        negX: await loadTexture("stormydays_bk.png"),
        posX: await loadTexture("stormydays_ft.png"),
        negY: await loadTexture("stormydays_dn.png"),
        posY: await loadTexture("stormydays_up.png"),
        negZ: await loadTexture("stormydays_lf.png"),
        posZ: await loadTexture("stormydays_rt.png")
    });

    let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
        .texture("cubemap", cubemap);

    function draw(timems) {
        // Drawing logic remains the same
        // Be sure to include all necessary uniform updates and matrix calculations
        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
}

setupTextures(); // Start the texture loading and rendering setup
