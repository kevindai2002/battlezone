// WebGL Context and Program
let gl;
let shaderProgram;

// Game state
const gameState = {
    player: {
        x: 0,
        z: 0,
        angle: 0
    },
    enemies: [
        { x: 20, z: 20, angle: 0 }
    ],
    obstacles: [
        { x: -15, z: 10, type: 'cube' },
        { x: 10, z: -15, type: 'pyramid' },
        { x: -10, z: -10, type: 'cube' },
        { x: 15, z: 15, type: 'pyramid' }
    ]
};

// Geometry buffers
let cubeBuffer, pyramidBuffer, groundBuffer;

// Input state
const keys = {};

// Matrix Math Utilities
const mat4 = {
    identity: function() {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    },

    perspective: function(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const nf = 1 / (near - far);
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0
        ];
    },

    ortho: function(left, right, bottom, top, near, far) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);
        return [
            -2 * lr, 0, 0, 0,
            0, -2 * bt, 0, 0,
            0, 0, 2 * nf, 0,
            (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
        ];
    },

    translate: function(x, y, z) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ];
    },

    rotateY: function(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return [
            c, 0, s, 0,
            0, 1, 0, 0,
            -s, 0, c, 0,
            0, 0, 0, 1
        ];
    },

    scale: function(x, y, z) {
        return [
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1
        ];
    },

    multiply: function(a, b) {
        const result = [];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[i + k * 4] * b[k + j * 4];
                }
                result[i + j * 4] = sum;
            }
        }
        return result;
    },

    lookAt: function(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {
        let zx = eyeX - centerX;
        let zy = eyeY - centerY;
        let zz = eyeZ - centerZ;
        let zlen = Math.sqrt(zx*zx + zy*zy + zz*zz);
        zx /= zlen; zy /= zlen; zz /= zlen;

        let xx = upY * zz - upZ * zy;
        let xy = upZ * zx - upX * zz;
        let xz = upX * zy - upY * zx;
        let xlen = Math.sqrt(xx*xx + xy*xy + xz*xz);
        xx /= xlen; xy /= xlen; xz /= xlen;

        const yx = zy * xz - zz * xy;
        const yy = zz * xx - zx * xz;
        const yz = zx * xy - zy * xx;

        return [
            xx, yx, zx, 0,
            xy, yy, zy, 0,
            xz, yz, zz, 0,
            -(xx * eyeX + xy * eyeY + xz * eyeZ),
            -(yx * eyeX + yy * eyeY + yz * eyeZ),
            -(zx * eyeX + zy * eyeY + zz * eyeZ),
            1
        ];
    }
};

// Geometry creation functions
function createCube(color) {
    const vertices = [
        // Front
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,
        -0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
        // Back
        -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
        -0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5,
        // Top
        -0.5,  0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,
        -0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5,
        // Bottom
        -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5,  0.5,
        -0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5,
        // Right
         0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,
         0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,
        // Left
        -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5,
        -0.5, -0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

function createPyramid(color) {
    const vertices = [
        // Base
        -0.5, 0, -0.5,  0.5, 0, -0.5,  0.5, 0,  0.5,
        -0.5, 0, -0.5,  0.5, 0,  0.5, -0.5, 0,  0.5,
        // Front
        -0.5, 0,  0.5,  0.5, 0,  0.5,  0, 1, 0,
        // Right
         0.5, 0,  0.5,  0.5, 0, -0.5,  0, 1, 0,
        // Back
         0.5, 0, -0.5, -0.5, 0, -0.5,  0, 1, 0,
        // Left
        -0.5, 0, -0.5, -0.5, 0,  0.5,  0, 1, 0
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

function createGround(size, color) {
    const vertices = [
        -size, 0, -size,  size, 0, -size,  size, 0,  size,
        -size, 0, -size,  size, 0,  size, -size, 0,  size
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

function createBuffers(geometry) {
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.vertices), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.colors), gl.STATIC_DRAW);

    return { vertexBuffer, colorBuffer, count: geometry.count };
}

function drawObject(buffer, modelMatrix, viewMatrix, projectionMatrix) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vertexBuffer);
    gl.vertexAttribPointer(shaderProgram.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.colorBuffer);
    gl.vertexAttribPointer(shaderProgram.aColor, 3, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(shaderProgram.uViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(shaderProgram.uProjectionMatrix, false, projectionMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, buffer.count);
}

// Shader source code
const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vColor;

    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
        vColor = aColor;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    varying vec3 vColor;

    void main() {
        gl_FragColor = vec4(vColor, 1.0);
    }
`;

// Initialize WebGL
function initWebGL() {
    const canvas = document.getElementById('glcanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = canvas.getContext('webgl');
    if (!gl) {
        alert('WebGL not supported');
        return false;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    return true;
}

// Compile shader
function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

// Initialize shaders
function initShaders() {
    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Shader program linking error:', gl.getProgramInfoLog(shaderProgram));
        return false;
    }

    gl.useProgram(shaderProgram);

    // Get attribute and uniform locations
    shaderProgram.aPosition = gl.getAttribLocation(shaderProgram, 'aPosition');
    shaderProgram.aColor = gl.getAttribLocation(shaderProgram, 'aColor');
    shaderProgram.uModelMatrix = gl.getUniformLocation(shaderProgram, 'uModelMatrix');
    shaderProgram.uViewMatrix = gl.getUniformLocation(shaderProgram, 'uViewMatrix');
    shaderProgram.uProjectionMatrix = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');

    gl.enableVertexAttribArray(shaderProgram.aPosition);
    gl.enableVertexAttribArray(shaderProgram.aColor);

    return true;
}

// Initialize geometry
function initGeometry() {
    cubeBuffer = createBuffers(createCube([0, 1, 0]));
    pyramidBuffer = createBuffers(createPyramid([1, 0, 0]));
    groundBuffer = createBuffers(createGround(50, [0.2, 0.2, 0.2]));
}

// Render scene
function render() {
    const canvas = gl.canvas;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // === MAIN VIEW (Perspective) ===
    gl.viewport(0, 0, canvas.width, canvas.height);

    const aspect = canvas.width / canvas.height;
    const projectionMatrix = mat4.perspective(Math.PI / 3, aspect, 0.1, 100.0);

    // View matrix (camera behind and above player tank)
    const eyeX = gameState.player.x - Math.sin(gameState.player.angle) * 2;
    const eyeZ = gameState.player.z - Math.cos(gameState.player.angle) * 2;
    const centerX = gameState.player.x + Math.sin(gameState.player.angle) * 10;
    const centerZ = gameState.player.z + Math.cos(gameState.player.angle) * 10;
    const viewMatrix = mat4.lookAt(
        eyeX, 1.5, eyeZ,
        centerX, 1, centerZ,
        0, 1, 0
    );

    // Draw ground
    drawObject(groundBuffer, mat4.identity(), viewMatrix, projectionMatrix);

    // Draw obstacles
    gameState.obstacles.forEach(obstacle => {
        const modelMatrix = mat4.multiply(
            mat4.translate(obstacle.x, 0.5, obstacle.z),
            mat4.scale(2, 2, 2)
        );
        const buffer = obstacle.type === 'cube' ? cubeBuffer : pyramidBuffer;
        drawObject(buffer, modelMatrix, viewMatrix, projectionMatrix);
    });

    // Draw enemy tank
    gameState.enemies.forEach(enemy => {
        const modelMatrix = mat4.multiply(
            mat4.translate(enemy.x, 0.5, enemy.z),
            mat4.multiply(
                mat4.rotateY(enemy.angle),
                mat4.scale(1.5, 1, 1.5)
            )
        );
        drawObject(pyramidBuffer, modelMatrix, viewMatrix, projectionMatrix);
    });

    // === RADAR VIEW (Orthographic top-down) ===
    const radarSize = 150;
    gl.viewport(canvas.width - radarSize - 10, canvas.height - radarSize - 10, radarSize, radarSize);

    const radarProjection = mat4.ortho(-30, 30, -30, 30, -1, 100);
    const radarView = mat4.lookAt(0, 50, 0, 0, 0, 0, 0, 0, -1);

    // Draw ground (smaller for radar)
    drawObject(groundBuffer, mat4.identity(), radarView, radarProjection);

    // Draw obstacles on radar
    gameState.obstacles.forEach(obstacle => {
        const modelMatrix = mat4.multiply(
            mat4.translate(obstacle.x, 0.5, obstacle.z),
            mat4.scale(2, 2, 2)
        );
        const buffer = obstacle.type === 'cube' ? cubeBuffer : pyramidBuffer;
        drawObject(buffer, modelMatrix, radarView, radarProjection);
    });

    // Draw enemy on radar
    gameState.enemies.forEach(enemy => {
        const modelMatrix = mat4.multiply(
            mat4.translate(enemy.x, 0.5, enemy.z),
            mat4.scale(1.5, 1, 1.5)
        );
        drawObject(pyramidBuffer, modelMatrix, radarView, radarProjection);
    });

    // Draw player on radar
    const playerModel = mat4.multiply(
        mat4.translate(gameState.player.x, 0.5, gameState.player.z),
        mat4.multiply(
            mat4.rotateY(gameState.player.angle),
            mat4.scale(1.5, 1, 1.5)
        )
    );
    drawObject(pyramidBuffer, playerModel, radarView, radarProjection);

    requestAnimationFrame(render);
}

// Main initialization
function init() {
    if (!initWebGL()) return;
    if (!initShaders()) return;
    initGeometry();

    console.log('WebGL initialized successfully');
    render();
}

// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Start the game
window.onload = init;
