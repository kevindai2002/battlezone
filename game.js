// WebGL Context and Program
let gl;
let shaderProgram;

// Game state
const gameState = {
    player: {
        x: 0,
        z: 0,
        angle: 0,
        turretAngle: 0, // For alternate mode: turret rotation
        velocity: 0, // For alternate mode: car-like movement speed
        dead: false,
        deadTime: 0,
        invulnerable: false,
        invulnerableTime: 0,
        health: 150,
        maxHealth: 150
    },
    playerShot: null,
    enemyShots: [],
    enemies: [
        { x: 20, z: 20, angle: 0, turretAngle: 0, shootTimer: 3 }
    ],
    obstacles: [], // Will be generated randomly
    healthPickups: [], // Health pickup items
    score: 0,
    wave: 1,
    enemiesKilledThisWave: 0,
    enemiesPerWave: 1, // Starting with 1 enemy
    lives: 3,
    gameOver: false,
    gameStarted: false
};

// Geometry buffers
let obstacleBuffer, enemyBuffer, groundBuffer, playerBuffer, playerRadarBuffer, enemyRadarBuffer;
// Alternate mode tank buffers
let tankBaseBuffer, tankTurretBuffer, tankCannonBuffer, tankArrowBuffer, movementArrowBuffer;
let enemyTankBaseBuffer, enemyTankTurretBuffer, enemyTankCannonBuffer; // Enemy tanks in tron red
// Alternate mode radar buffers
let radarGridBuffer, radarPlayerArrowBuffer;
// Shot buffer and health pickup buffer for alternate mode
let shotBuffer, heartBuffer;

// Input state
const keys = {};

// Time tracking
let lastTime = 0;

// Alternate mode flag
let alternateMode = false; // Normal mode is default

// Camera angles for alternate mode
let cameraYaw = 0;   // Horizontal rotation (left/right)
let cameraPitch = 0; // Vertical rotation (up/down)
const maxPitch = Math.PI / 3; // Limit pitch to 60 degrees up/down
const cameraRotateSpeed = 2.0; // Camera rotation speed with arrow keys

// High score (persisted in localStorage)
let highScore = 0;

// Game constants
const PLAYER_RADIUS = 1.5;
const ENEMY_RADIUS = 1.5;
const SHOT_RADIUS = 0.5;
const PICKUP_RADIUS = 0.8;
const OBSTACLE_COLLISION_MULTIPLIER = 1.2;

// UI elements
let countdownElement;
let invulnerableElement;
let scoreElement;
let healthFillElement;
let healthTextElement;
let gameOverElement;
let startScreenElement;
let startButtonElement;
let restartButtonElement;

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

function createSphere(color, segments = 16) {
    const vertices = [];
    const latSegments = segments;
    const lonSegments = segments;

    // Generate vertices
    for (let lat = 0; lat <= latSegments; lat++) {
        const theta = (lat * Math.PI) / latSegments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= lonSegments; lon++) {
            const phi = (lon * 2 * Math.PI) / lonSegments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta * 0.5;
            const y = cosTheta * 0.5;
            const z = sinPhi * sinTheta * 0.5;

            // Create triangles for each quad
            if (lat < latSegments && lon < lonSegments) {
                // First triangle
                vertices.push(x, y, z);

                const theta1 = ((lat + 1) * Math.PI) / latSegments;
                const phi0 = phi;
                vertices.push(
                    Math.cos(phi0) * Math.sin(theta1) * 0.5,
                    Math.cos(theta1) * 0.5,
                    Math.sin(phi0) * Math.sin(theta1) * 0.5
                );

                const phi1 = ((lon + 1) * 2 * Math.PI) / lonSegments;
                vertices.push(
                    Math.cos(phi1) * Math.sin(theta) * 0.5,
                    y,
                    Math.sin(phi1) * Math.sin(theta) * 0.5
                );

                // Second triangle
                vertices.push(
                    Math.cos(phi1) * Math.sin(theta) * 0.5,
                    y,
                    Math.sin(phi1) * Math.sin(theta) * 0.5
                );

                vertices.push(
                    Math.cos(phi0) * Math.sin(theta1) * 0.5,
                    Math.cos(theta1) * 0.5,
                    Math.sin(phi0) * Math.sin(theta1) * 0.5
                );

                vertices.push(
                    Math.cos(phi1) * Math.sin(theta1) * 0.5,
                    Math.cos(theta1) * 0.5,
                    Math.sin(phi1) * Math.sin(theta1) * 0.5
                );
            }
        }
    }

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

function createHeart(color) {
    // Simple heart shape using a rotated cube/diamond
    const vertices = [
        // Front face
        0, 0.5, 0.3,   -0.3, 0, 0.3,   0.3, 0, 0.3,
        // Back face
        0, 0.5, -0.3,   0.3, 0, -0.3,   -0.3, 0, -0.3,
        // Left face
        0, 0.5, 0.3,   -0.3, 0, 0.3,   -0.3, 0, -0.3,
        0, 0.5, 0.3,   -0.3, 0, -0.3,   0, 0.5, -0.3,
        // Right face
        0, 0.5, 0.3,   0.3, 0, -0.3,   0.3, 0, 0.3,
        0, 0.5, 0.3,   0, 0.5, -0.3,   0.3, 0, -0.3,
        // Bottom left
        -0.3, 0, 0.3,   0, -0.5, 0,   -0.3, 0, -0.3,
        // Bottom right
        0.3, 0, 0.3,   0.3, 0, -0.3,   0, -0.5, 0,
        // Bottom front
        -0.3, 0, 0.3,   0.3, 0, 0.3,   0, -0.5, 0,
        // Bottom back
        0.3, 0, -0.3,   -0.3, 0, -0.3,   0, -0.5, 0
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Tank base: a flat rectangle (low box)
// Front faces in positive Z direction, width spans X axis
function createTankBase(color) {
    const width = 1.0;   // Left-right dimension (narrower)
    const length = 1.5;  // Front-back dimension (longer)
    const height = 0.3;
    
    const vertices = [
        // Front (positive Z)
        -width/2, 0,  length/2,   width/2, 0,  length/2,   width/2, height,  length/2,
        -width/2, 0,  length/2,   width/2, height,  length/2, -width/2, height,  length/2,
        // Back (negative Z)
        -width/2, 0, -length/2, -width/2, height, -length/2,   width/2, height, -length/2,
        -width/2, 0, -length/2,   width/2, height, -length/2,   width/2, 0, -length/2,
        // Top
        -width/2, height, -length/2, -width/2, height,  length/2,   width/2, height,  length/2,
        -width/2, height, -length/2,   width/2, height,  length/2,   width/2, height, -length/2,
        // Bottom
        -width/2, 0, -length/2,   width/2, 0, -length/2,   width/2, 0,  length/2,
        -width/2, 0, -length/2,   width/2, 0,  length/2, -width/2, 0,  length/2,
        // Right (positive X)
         width/2, 0, -length/2,   width/2, height, -length/2,   width/2, height,  length/2,
         width/2, 0, -length/2,   width/2, height,  length/2,   width/2, 0,  length/2,
        // Left (negative X)
        -width/2, 0, -length/2, -width/2, 0,  length/2, -width/2, height,  length/2,
        -width/2, 0, -length/2, -width/2, height,  length/2, -width/2, height, -length/2
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Tank turret: a smaller box on top
function createTankTurret(color) {
    const width = 0.6;   // Left-right dimension (narrower)
    const length = 0.8;  // Front-back dimension (longer)
    const height = 0.4;
    const baseY = 0.3; // Sits on top of base
    
    const vertices = [
        // Front
        -width/2, baseY,  length/2,   width/2, baseY,  length/2,   width/2, baseY + height,  length/2,
        -width/2, baseY,  length/2,   width/2, baseY + height,  length/2, -width/2, baseY + height,  length/2,
        // Back
        -width/2, baseY, -length/2, -width/2, baseY + height, -length/2,   width/2, baseY + height, -length/2,
        -width/2, baseY, -length/2,   width/2, baseY + height, -length/2,   width/2, baseY, -length/2,
        // Top
        -width/2, baseY + height, -length/2, -width/2, baseY + height,  length/2,   width/2, baseY + height,  length/2,
        -width/2, baseY + height, -length/2,   width/2, baseY + height,  length/2,   width/2, baseY + height, -length/2,
        // Bottom
        -width/2, baseY, -length/2,   width/2, baseY, -length/2,   width/2, baseY,  length/2,
        -width/2, baseY, -length/2,   width/2, baseY,  length/2, -width/2, baseY,  length/2,
        // Right
         width/2, baseY, -length/2,   width/2, baseY + height, -length/2,   width/2, baseY + height,  length/2,
         width/2, baseY, -length/2,   width/2, baseY + height,  length/2,   width/2, baseY,  length/2,
        // Left
        -width/2, baseY, -length/2, -width/2, baseY,  length/2, -width/2, baseY + height,  length/2,
        -width/2, baseY, -length/2, -width/2, baseY + height,  length/2, -width/2, baseY + height, -length/2
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Tank cannon: cylindrical barrel extending from turret
function createTankCannon(color) {
    const radius = 0.08;  // Thin barrel
    const length = 1.2;   // Extends forward from turret
    const segments = 12;  // Number of sides for cylinder
    const baseY = 0.5;    // Height at center of turret
    const startZ = 0.4;   // Start at front of turret

    const vertices = [];

    // Create cylinder using triangles
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;

        const x1 = Math.cos(angle1) * radius;
        const y1 = Math.sin(angle1) * radius;
        const x2 = Math.cos(angle2) * radius;
        const y2 = Math.sin(angle2) * radius;

        // Side faces (two triangles per segment)
        // Front triangle
        vertices.push(
            x1, baseY + y1, startZ,
            x2, baseY + y2, startZ,
            x1, baseY + y1, startZ + length
        );

        // Back triangle
        vertices.push(
            x2, baseY + y2, startZ,
            x2, baseY + y2, startZ + length,
            x1, baseY + y1, startZ + length
        );

        // Front cap (at barrel start)
        vertices.push(
            0, baseY, startZ,
            x2, baseY + y2, startZ,
            x1, baseY + y1, startZ
        );

        // Back cap (at barrel end)
        vertices.push(
            0, baseY, startZ + length,
            x1, baseY + y1, startZ + length,
            x2, baseY + y2, startZ + length
        );
    }

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Tank arrow: simple arrow pointing forward for debugging
function createTankArrow(color) {
    const length = 0.8;
    const width = 0.2;
    const height = 0.05;
    const arrowHeadSize = 0.3;
    const baseY = 0.35; // Sits on top of turret
    
    const vertices = [
        // Arrow shaft (rectangle pointing forward in +Z direction)
        // Front face
        -width/2, baseY, length/2,  width/2, baseY, length/2,  width/2, baseY + height, length/2,
        -width/2, baseY, length/2,  width/2, baseY + height, length/2, -width/2, baseY + height, length/2,
        // Back face
        -width/2, baseY, 0, -width/2, baseY + height, 0,  width/2, baseY + height, 0,
        -width/2, baseY, 0,  width/2, baseY + height, 0,  width/2, baseY, 0,
        // Top
        -width/2, baseY + height, 0, -width/2, baseY + height, length/2,  width/2, baseY + height, length/2,
        -width/2, baseY + height, 0,  width/2, baseY + height, length/2,  width/2, baseY + height, 0,
        // Bottom
        -width/2, baseY, 0,  width/2, baseY, 0,  width/2, baseY, length/2,
        -width/2, baseY, 0,  width/2, baseY, length/2, -width/2, baseY, length/2,
        // Right
         width/2, baseY, 0,  width/2, baseY + height, 0,  width/2, baseY + height, length/2,
         width/2, baseY, 0,  width/2, baseY + height, length/2,  width/2, baseY, length/2,
        // Left
        -width/2, baseY, 0, -width/2, baseY, length/2, -width/2, baseY + height, length/2,
        -width/2, baseY, 0, -width/2, baseY + height, length/2, -width/2, baseY + height, 0,
        
        // Arrow head (triangle pointing forward)
        // Top triangle
        0, baseY + height, length/2 + arrowHeadSize,  -arrowHeadSize, baseY + height, length/2,  arrowHeadSize, baseY + height, length/2,
        // Bottom triangle
        0, baseY, length/2 + arrowHeadSize,  arrowHeadSize, baseY, length/2,  -arrowHeadSize, baseY, length/2,
        // Left side
        -arrowHeadSize, baseY, length/2,  -arrowHeadSize, baseY + height, length/2,  0, baseY + height, length/2 + arrowHeadSize,
        -arrowHeadSize, baseY, length/2,  0, baseY + height, length/2 + arrowHeadSize,  0, baseY, length/2 + arrowHeadSize,
        // Right side
         arrowHeadSize, baseY, length/2,  0, baseY, length/2 + arrowHeadSize,  0, baseY + height, length/2 + arrowHeadSize,
         arrowHeadSize, baseY, length/2,  0, baseY + height, length/2 + arrowHeadSize,  arrowHeadSize, baseY + height, length/2
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Movement direction arrow: shows actual movement direction
function createMovementArrow(color) {
    const length = 1.0;
    const width = 0.15;
    const height = 0.03;
    const arrowHeadSize = 0.4;
    const baseY = 0.4; // Sits above the forward arrow
    
    const vertices = [
        // Arrow shaft (rectangle pointing forward in +Z direction)
        // Front face
        -width/2, baseY, length/2,  width/2, baseY, length/2,  width/2, baseY + height, length/2,
        -width/2, baseY, length/2,  width/2, baseY + height, length/2, -width/2, baseY + height, length/2,
        // Back face
        -width/2, baseY, 0, -width/2, baseY + height, 0,  width/2, baseY + height, 0,
        -width/2, baseY, 0,  width/2, baseY + height, 0,  width/2, baseY, 0,
        // Top
        -width/2, baseY + height, 0, -width/2, baseY + height, length/2,  width/2, baseY + height, length/2,
        -width/2, baseY + height, 0,  width/2, baseY + height, length/2,  width/2, baseY + height, 0,
        // Bottom
        -width/2, baseY, 0,  width/2, baseY, 0,  width/2, baseY, length/2,
        -width/2, baseY, 0,  width/2, baseY, length/2, -width/2, baseY, length/2,
        // Right
         width/2, baseY, 0,  width/2, baseY + height, 0,  width/2, baseY + height, length/2,
         width/2, baseY, 0,  width/2, baseY + height, length/2,  width/2, baseY, length/2,
        // Left
        -width/2, baseY, 0, -width/2, baseY, length/2, -width/2, baseY + height, length/2,
        -width/2, baseY, 0, -width/2, baseY + height, length/2, -width/2, baseY + height, 0,
        
        // Arrow head (triangle pointing forward)
        // Top triangle
        0, baseY + height, length/2 + arrowHeadSize,  -arrowHeadSize, baseY + height, length/2,  arrowHeadSize, baseY + height, length/2,
        // Bottom triangle
        0, baseY, length/2 + arrowHeadSize,  arrowHeadSize, baseY, length/2,  -arrowHeadSize, baseY, length/2,
        // Left side
        -arrowHeadSize, baseY, length/2,  -arrowHeadSize, baseY + height, length/2,  0, baseY + height, length/2 + arrowHeadSize,
        -arrowHeadSize, baseY, length/2,  0, baseY + height, length/2 + arrowHeadSize,  0, baseY, length/2 + arrowHeadSize,
        // Right side
         arrowHeadSize, baseY, length/2,  0, baseY, length/2 + arrowHeadSize,  0, baseY + height, length/2 + arrowHeadSize,
         arrowHeadSize, baseY, length/2,  0, baseY + height, length/2 + arrowHeadSize,  arrowHeadSize, baseY + height, length/2
    ];

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Radar grid: grid lines for alternate mode radar
function createRadarGrid(color, size, spacing) {
    const vertices = [];
    const halfSize = size / 2;
    const gridHeight = 0.0; // On the ground so objects cover it

    // Vertical lines (parallel to Z axis)
    for (let x = -halfSize; x <= halfSize; x += spacing) {
        vertices.push(x, gridHeight, -halfSize, x, gridHeight, halfSize);
    }

    // Horizontal lines (parallel to X axis)
    for (let z = -halfSize; z <= halfSize; z += spacing) {
        vertices.push(-halfSize, gridHeight, z, halfSize, gridHeight, z);
    }

    const colors = [];
    for (let i = 0; i < vertices.length / 3; i++) {
        colors.push(color[0], color[1], color[2]);
    }

    return { vertices, colors, count: vertices.length / 3 };
}

// Radar player triangle: isosceles triangle pointing forward
function createRadarPlayerTriangle(color) {
    const base = 0.8;  // Base width of triangle
    const height = 1.2;  // Height of triangle (pointing forward)
    
    const vertices = [
        // Isosceles triangle pointing in +Z direction
        // Base vertices (back of triangle)
        -base/2, 0, 0,  base/2, 0, 0,  0, 0, height,  // Front triangle
        -base/2, 0, 0,  0, 0, height,  base/2, 0, 0    // Back triangle (same, for double-sided)
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

function drawObject(buffer, modelMatrix, viewMatrix, projectionMatrix, drawMode = gl.TRIANGLES) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vertexBuffer);
    gl.vertexAttribPointer(shaderProgram.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.colorBuffer);
    gl.vertexAttribPointer(shaderProgram.aColor, 3, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(shaderProgram.uModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(shaderProgram.uViewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(shaderProgram.uProjectionMatrix, false, projectionMatrix);

    gl.drawArrays(drawMode, 0, buffer.count);
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
    if (alternateMode) {
        // Alternate mode: neon colors
        obstacleBuffer = createBuffers(createCube([0.5, 0.5, 0.5]));      // Gray obstacles
        enemyBuffer = createBuffers(createPyramid([1, 0, 0])); // Red enemies (for radar only)
        playerBuffer = createBuffers(createCube([0, 0.5, 1])); // Tron blue player (not used in main view)
        playerRadarBuffer = createBuffers(createPyramid([0, 0.5, 1])); // Tron blue player radar icon
        enemyRadarBuffer = createBuffers(createPyramid([1, 0, 0])); // Red enemy radar icon
        groundBuffer = createBuffers(createGround(200, [0.05, 0.0, 0.1])); // Darker purple - extended size
        // Tank geometry for alternate mode - Player (tron blue)
        tankBaseBuffer = createBuffers(createTankBase([0, 0.5, 1])); // Tron blue base
        tankTurretBuffer = createBuffers(createTankTurret([0.3, 0.7, 1])); // Light tron blue turret
        tankCannonBuffer = createBuffers(createTankCannon([0.2, 0.6, 0.9])); // Darker blue cannon
        tankArrowBuffer = createBuffers(createTankArrow([0, 0.8, 1])); // Bright blue arrow pointing forward (base direction)
        movementArrowBuffer = createBuffers(createMovementArrow([1, 0, 0])); // Red arrow pointing in movement direction
        // Enemy tank geometry (tron red)
        enemyTankBaseBuffer = createBuffers(createTankBase([1, 0, 0])); // Tron red base
        enemyTankTurretBuffer = createBuffers(createTankTurret([1, 0.3, 0.3])); // Light tron red turret
        enemyTankCannonBuffer = createBuffers(createTankCannon([0.8, 0.2, 0.2])); // Darker red cannon
        // Radar geometry for alternate mode
        radarGridBuffer = createBuffers(createRadarGrid([0.8, 0.6, 1.0], 200, 5)); // More opaque purple grid lines - full floor size
        radarPlayerArrowBuffer = createBuffers(createRadarPlayerTriangle([0, 0.5, 1])); // Tron blue triangle for player on radar
        // Shot geometry for alternate mode
        shotBuffer = createBuffers(createSphere([1, 1, 0])); // Yellow shots
        // Health pickup geometry for alternate mode
        heartBuffer = createBuffers(createHeart([1, 0, 1])); // Magenta hearts
    } else {
        // Normal mode: original colors
        obstacleBuffer = createBuffers(createCube([0.5, 0.5, 0.5]));      // Gray obstacles
        enemyBuffer = createBuffers(createPyramid([1, 0, 0])); // Red enemies
        playerBuffer = createBuffers(createCube([0.6, 0.85, 1.0])); // Carolina blue player (not used in main view)
        playerRadarBuffer = createBuffers(createPyramid([0.6, 0.85, 1.0])); // Carolina blue player radar icon
        enemyRadarBuffer = createBuffers(createPyramid([1, 0, 0])); // Red enemy radar icon
        groundBuffer = createBuffers(createGround(200, [0.2, 0.2, 0.2])); // Gray - extended size
        // Health pickup geometry for normal mode
        heartBuffer = createBuffers(createHeart([1, 0, 0.5])); // Pink hearts
    }
}

// Check collision between two objects
function checkCollision(x1, z1, x2, z2, radius1, radius2) {
    const dx = x1 - x2;
    const dz = z1 - z2;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance < (radius1 + radius2);
}

// Update enemies
function updateEnemies(deltaTime) {
    const enemySpeed = 5 * deltaTime;
    const enemyTurnSpeed = 1 * deltaTime; // Slower turn speed to see rotation

    gameState.enemies.forEach(enemy => {
        // Check for obstacles ahead and nearby
        const lookAheadDist = 5;
        const tooCloseDist = 3;
        const lookAheadX = enemy.x + Math.sin(enemy.angle) * lookAheadDist;
        const lookAheadZ = enemy.z + Math.cos(enemy.angle) * lookAheadDist;

        let obstacleAhead = false;
        let obstacleTooClose = false;
        let avoidLeft = false;

        // Check if obstacle is in front or too close
        for (const obstacle of gameState.obstacles) {
            const obstacleRadius = (obstacle.size || 1.0) * 1.2; // Use obstacle size for collision
            const dx = obstacle.x - enemy.x;
            const dz = obstacle.z - enemy.z;
            const distToObstacle = Math.sqrt(dx * dx + dz * dz);

            // Check if obstacle is directly ahead
            if (checkCollision(lookAheadX, lookAheadZ, obstacle.x, obstacle.z, ENEMY_RADIUS, obstacleRadius)) {
                obstacleAhead = true;
                // Determine which way to turn to avoid
                const obstacleAngle = Math.atan2(dx, dz);
                let angleDiffToObstacle = obstacleAngle - enemy.angle;
                while (angleDiffToObstacle > Math.PI) angleDiffToObstacle -= 2 * Math.PI;
                while (angleDiffToObstacle < -Math.PI) angleDiffToObstacle += 2 * Math.PI;
                avoidLeft = angleDiffToObstacle > 0;
            }

            // Check if obstacle is too close (need to back up)
            if (distToObstacle < tooCloseDist + obstacleRadius) {
                obstacleTooClose = true;
            }

            if (obstacleAhead || obstacleTooClose) break;
        }

        // Decide on movement
        if (obstacleTooClose) {
            // Back up and turn if too close to obstacle
            if (avoidLeft) {
                enemy.angle -= enemyTurnSpeed * 2;
            } else {
                enemy.angle += enemyTurnSpeed * 2;
            }
        } else if (obstacleAhead) {
            // Avoid obstacle by turning away
            if (avoidLeft) {
                enemy.angle -= enemyTurnSpeed * 1.5;
            } else {
                enemy.angle += enemyTurnSpeed * 1.5;
            }
        } else if (gameState.player.dead) {
            // If player is dead, just wander randomly
            if (Math.random() < 0.1) {
                const randomTurn = (Math.random() - 0.5) * enemyTurnSpeed * 3;
                enemy.angle += randomTurn;
            }
        } else {
            // Player is alive - track them
            const dx = gameState.player.x - enemy.x;
            const dz = gameState.player.z - enemy.z;
            const targetAngle = Math.atan2(dx, dz);

            // Calculate angle difference
            let angleDiff = targetAngle - enemy.angle;
            // Normalize angle difference to [-PI, PI]
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            if (Math.random() < 0.4) {
                // Increased random variation (40% chance to turn randomly)
                const randomTurn = (Math.random() - 0.5) * enemyTurnSpeed * 3;
                enemy.angle += randomTurn;
            } else {
                // Turn toward player at fixed speed
                if (angleDiff > 0) {
                    enemy.angle += enemyTurnSpeed;
                } else {
                    enemy.angle -= enemyTurnSpeed;
                }
            }
        }

        // Move forward or backward depending on situation
        let moveMultiplier = 1; // 1 = forward, -1 = backward
        if (obstacleTooClose) {
            moveMultiplier = -1; // Back up if too close to obstacle
        }

        const moveX = Math.sin(enemy.angle) * enemySpeed * moveMultiplier;
        const moveZ = Math.cos(enemy.angle) * enemySpeed * moveMultiplier;

        // Calculate new position
        const newX = enemy.x + moveX;
        const newZ = enemy.z + moveZ;

        // Check collisions
        let collided = false;

        // Check obstacles
        if (!collided) {
            for (const obstacle of gameState.obstacles) {
                const obstacleRadius = (obstacle.size || 1.0) * OBSTACLE_COLLISION_MULTIPLIER;
                if (checkCollision(newX, newZ, obstacle.x, obstacle.z, ENEMY_RADIUS, obstacleRadius)) {
                    collided = true;
                    break;
                }
            }
        }

        // Check other enemies
        if (!collided) {
            for (const other of gameState.enemies) {
                if (other !== enemy && checkCollision(newX, newZ, other.x, other.z, ENEMY_RADIUS, ENEMY_RADIUS)) {
                    collided = true;
                    break;
                }
            }
        }

        // Check player
        if (!collided && checkCollision(newX, newZ, gameState.player.x, gameState.player.z, ENEMY_RADIUS, PLAYER_RADIUS)) {
            collided = true;
        }

        // Update position if no collision
        if (!collided) {
            enemy.x = newX;
            enemy.z = newZ;
        }

        // Handle shooting - only shoot at player if they're alive
        if (!gameState.player.dead) {
            // Calculate direction to player
            const dx = gameState.player.x - enemy.x;
            const dz = gameState.player.z - enemy.z;
            const angleToPlayer = Math.atan2(dx, dz);

            // Update turret angle to always track player
            enemy.turretAngle = angleToPlayer;

            enemy.shootTimer -= deltaTime;
            if (enemy.shootTimer <= 0) {
                gameState.enemyShots.push({
                    x: enemy.x,
                    z: enemy.z,
                    vx: Math.sin(angleToPlayer) * 25,
                    vz: Math.cos(angleToPlayer) * 25
                });
                if (!alternateMode) {
                    enemy.angle = angleToPlayer;
                } else {
                    // In alternate mode, use turret angle for shooting
                    gameState.enemyShots[gameState.enemyShots.length - 1].vx = Math.sin(enemy.turretAngle) * 25;
                    gameState.enemyShots[gameState.enemyShots.length - 1].vz = Math.cos(enemy.turretAngle) * 25;
                }
                enemy.shootTimer = 3 + Math.random() * 2;
            }
        }
    });
}

// Update player based on input
function updatePlayer(deltaTime) {
    // Handle dead state
    if (gameState.player.dead) {
        gameState.player.deadTime -= deltaTime;
        if (gameState.player.deadTime <= 0) {
            gameState.player.dead = false;
            gameState.player.invulnerable = true;
            gameState.player.invulnerableTime = 5;
            gameState.player.health = gameState.player.maxHealth; // Restore full health on respawn
        }
        return; // Player cannot move while dead
    }

    const moveSpeed = 10 * deltaTime;
    const turnSpeed = 2 * deltaTime;
    const playerRadius = 0.6; // Extremely tight collision for more accurate tank hitbox

    if (alternateMode) {
        // Alternate mode: Tank base rotation with A/D, movement with W/S
        const moveSpeed = 10 * deltaTime;
        const baseRotateSpeed = 2.0 * deltaTime;
        
        // A/D keys rotate the tank base (same logic as turret rotation with arrow keys)
        if (keys['a'] || keys['A']) {
            // Rotate left (counter-clockwise) - decrease angle
            gameState.player.angle -= baseRotateSpeed;
        }
        if (keys['d'] || keys['D']) {
            // Rotate right (clockwise) - increase angle
            gameState.player.angle += baseRotateSpeed;
        }
        
        // Calculate new position based on tank base angle
        // Use same negation logic as shooting direction
        let newX = gameState.player.x;
        let newZ = gameState.player.z;
        
        // W moves forward, S moves backward in the direction tank is facing
        // Apply same negation as shooting to match visual rotation
        const moveAngle = -gameState.player.angle;
        if (keys['w'] || keys['W']) {
            // Move forward in direction tank base is facing
            newX += Math.sin(moveAngle) * moveSpeed;
            newZ += Math.cos(moveAngle) * moveSpeed;
        }
        if (keys['s'] || keys['S']) {
            // Move backward (opposite to facing direction)
            newX -= Math.sin(moveAngle) * moveSpeed;
            newZ -= Math.cos(moveAngle) * moveSpeed;
        }

        // Check collisions with obstacles
        let collided = false;
        if (!collided) {
            for (const obstacle of gameState.obstacles) {
                const obstacleRadius = (obstacle.size || 1.0) * OBSTACLE_COLLISION_MULTIPLIER;
                if (checkCollision(newX, newZ, obstacle.x, obstacle.z, playerRadius, obstacleRadius)) {
                    collided = true;
                    break;
                }
            }
        }

        // Check collisions with enemies
        if (!collided) {
            for (const enemy of gameState.enemies) {
                if (checkCollision(newX, newZ, enemy.x, enemy.z, playerRadius, ENEMY_RADIUS)) {
                    collided = true;
                    break;
                }
            }
        }

        // Update position only if no collision
        if (!collided) {
            gameState.player.x = newX;
            gameState.player.z = newZ;
        }

        // Handle shooting - use turret angle in alternate mode
        if (keys[' '] && !gameState.playerShot) {
            // Negate turret angle to match the corrected turret rotation direction
            const shootAngle = -gameState.player.turretAngle;
            const startX = gameState.player.x + Math.sin(shootAngle) * 2;
            const startZ = gameState.player.z + Math.cos(shootAngle) * 2;
            gameState.playerShot = {
                x: startX,
                z: startZ,
                startX: startX,
                startZ: startZ,
                vx: Math.sin(shootAngle) * 30,
                vz: Math.cos(shootAngle) * 30
            };
        }
    } else {
        // Normal mode: original controls
        // Rotation
        if (keys['ArrowLeft']) {
            gameState.player.angle += turnSpeed;
        }
        if (keys['ArrowRight']) {
            gameState.player.angle -= turnSpeed;
        }

        // Calculate new position
        let newX = gameState.player.x;
        let newZ = gameState.player.z;

        if (keys['ArrowUp']) {
            newX += Math.sin(gameState.player.angle) * moveSpeed;
            newZ += Math.cos(gameState.player.angle) * moveSpeed;
        }
        if (keys['ArrowDown']) {
            newX -= Math.sin(gameState.player.angle) * moveSpeed;
            newZ -= Math.cos(gameState.player.angle) * moveSpeed;
        }

        // Check collisions with obstacles
        let collided = false;
        if (!collided) {
            for (const obstacle of gameState.obstacles) {
                const obstacleRadius = (obstacle.size || 1.0) * OBSTACLE_COLLISION_MULTIPLIER;
                if (checkCollision(newX, newZ, obstacle.x, obstacle.z, playerRadius, obstacleRadius)) {
                    collided = true;
                    break;
                }
            }
        }

        // Check collisions with enemies
        if (!collided) {
            for (const enemy of gameState.enemies) {
                if (checkCollision(newX, newZ, enemy.x, enemy.z, playerRadius, ENEMY_RADIUS)) {
                    collided = true;
                    break;
                }
            }
        }

        // Update position only if no collision
        if (!collided) {
            gameState.player.x = newX;
            gameState.player.z = newZ;
        }

        // Handle shooting
        if (keys[' '] && !gameState.playerShot) {
            const startX = gameState.player.x + Math.sin(gameState.player.angle) * 2;
            const startZ = gameState.player.z + Math.cos(gameState.player.angle) * 2;
            gameState.playerShot = {
                x: startX,
                z: startZ,
                startX: startX,
                startZ: startZ,
                vx: Math.sin(gameState.player.angle) * 30,
                vz: Math.cos(gameState.player.angle) * 30
            };
        }
    }

    // Handle invulnerability
    if (gameState.player.invulnerable) {
        gameState.player.invulnerableTime -= deltaTime;
        if (gameState.player.invulnerableTime <= 0) {
            gameState.player.invulnerable = false;
        }
    }

    // Check health pickup collisions (only in alternate mode)
    if (alternateMode) {
        for (let i = gameState.healthPickups.length - 1; i >= 0; i--) {
            const pickup = gameState.healthPickups[i];
            if (checkCollision(gameState.player.x, gameState.player.z, pickup.x, pickup.z, PLAYER_RADIUS, PICKUP_RADIUS)) {
                // Remove the pickup
                gameState.healthPickups.splice(i, 1);

                // 50% chance to heal or boost max health
                if (Math.random() < 0.5) {
                    // Heal 20 health (capped at max)
                    gameState.player.health = Math.min(gameState.player.health + 20, gameState.player.maxHealth);
                } else {
                    // Boost max health by 20 and heal to new max
                    gameState.player.maxHealth += 20;
                    gameState.player.health = gameState.player.maxHealth;
                }

                // Spawn a new health pickup to replace the collected one
                spawnHealthPickup();
            }
        }
    }
}

// Update shots
function updateShots(deltaTime) {
    const fieldSize = 200; // Extended to match larger floor

    // Update player shot
    if (gameState.playerShot) {
        gameState.playerShot.x += gameState.playerShot.vx * deltaTime;
        gameState.playerShot.z += gameState.playerShot.vz * deltaTime;

        // Calculate distance traveled
        const dx = gameState.playerShot.x - gameState.playerShot.startX;
        const dz = gameState.playerShot.z - gameState.playerShot.startZ;
        const distanceTraveled = Math.sqrt(dx * dx + dz * dz);
        const maxDistance = 60; // Maximum distance bullets can travel

        // Check if out of bounds or traveled too far
        if (Math.abs(gameState.playerShot.x) > fieldSize || Math.abs(gameState.playerShot.z) > fieldSize || distanceTraveled > maxDistance) {
            gameState.playerShot = null;
        } else {
            // Check collision with obstacles
            for (const obstacle of gameState.obstacles) {
                const obstacleRadius = (obstacle.size || 1.0) * OBSTACLE_COLLISION_MULTIPLIER;
                if (checkCollision(gameState.playerShot.x, gameState.playerShot.z, obstacle.x, obstacle.z, SHOT_RADIUS, obstacleRadius)) {
                    gameState.playerShot = null;
                    break;
                }
            }

            // Check collision with enemies
            if (gameState.playerShot) {
                for (let i = gameState.enemies.length - 1; i >= 0; i--) {
                    const enemy = gameState.enemies[i];
                    if (checkCollision(gameState.playerShot.x, gameState.playerShot.z, enemy.x, enemy.z, SHOT_RADIUS, ENEMY_RADIUS)) {
                        gameState.playerShot = null;
                        gameState.enemies.splice(i, 1);

                        if (alternateMode) {
                            // Alternate mode: score and wave system
                            // Update score (1 point per enemy * wave multiplier)
                            gameState.score += 1 * gameState.wave;
                            gameState.enemiesKilledThisWave++;

                            // Check if wave is complete
                            if (gameState.enemiesKilledThisWave >= gameState.enemiesPerWave) {
                                // Start next wave
                                gameState.wave++;
                                gameState.enemiesPerWave = gameState.wave; // Each wave has wave number of enemies
                                gameState.enemiesKilledThisWave = 0;

                                // Spawn all enemies for new wave
                                for (let j = 0; j < gameState.enemiesPerWave; j++) {
                                    spawnEnemy();
                                }
                            } else {
                                // Spawn replacement enemy for current wave
                                spawnEnemy();
                            }
                        } else {
                            // Normal mode: just respawn one enemy
                            spawnEnemy();
                        }
                        break;
                    }
                }
            }
        }
    }

    // Update enemy shots
    for (let i = gameState.enemyShots.length - 1; i >= 0; i--) {
        const shot = gameState.enemyShots[i];
        shot.x += shot.vx * deltaTime;
        shot.z += shot.vz * deltaTime;

        // Check if out of bounds
        if (Math.abs(shot.x) > fieldSize || Math.abs(shot.z) > fieldSize) {
            gameState.enemyShots.splice(i, 1);
            continue;
        }

        // Check collision with obstacles
        let hitObstacle = false;
        for (const obstacle of gameState.obstacles) {
            const obstacleRadius = (obstacle.size || 1.0) * 1.2; // Use obstacle size for collision
            if (checkCollision(shot.x, shot.z, obstacle.x, obstacle.z, SHOT_RADIUS, obstacleRadius)) {
                gameState.enemyShots.splice(i, 1);
                hitObstacle = true;
                break;
            }
        }

        if (hitObstacle) continue;

        // Check collision with player
        if (!gameState.player.invulnerable && !gameState.player.dead &&
            checkCollision(shot.x, shot.z, gameState.player.x, gameState.player.z, SHOT_RADIUS, PLAYER_RADIUS)) {
            gameState.enemyShots.splice(i, 1);

            if (alternateMode) {
                // Alternate mode: health system with damage based on wave and lives
                const damage = 30 + (gameState.wave - 1) * 1;
                gameState.player.health -= damage;
                if (gameState.player.health <= 0) {
                    // Player dies - lose a life
                    gameState.lives--;
                    if (gameState.lives <= 0) {
                        // Game over - update high score
                        gameState.gameOver = true;
                        gameState.player.health = 0;
                        updateHighScore(gameState.score);
                    } else {
                        // Enter dead state for 3 seconds, then respawn with invulnerability
                        gameState.player.dead = true;
                        gameState.player.deadTime = 3;
                        gameState.player.health = 0;
                    }
                }
            } else {
                // Normal mode: instant death, respawn immediately (no lives/game over)
                gameState.player.dead = true;
                gameState.player.deadTime = 3;
            }
        }
    }
}

// Spawn enemy at random edge
function spawnEnemy() {
    const minDistanceFromObstacles = 5; // Minimum distance from obstacles
    const enemyRadius = 1.5;
    let x, z;
    let validPosition = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!validPosition && attempts < maxAttempts) {
        // Pick random edge
        const edge = Math.floor(Math.random() * 4);

        switch(edge) {
            case 0: x = -45; z = (Math.random() - 0.5) * 80; break;
            case 1: x = 45; z = (Math.random() - 0.5) * 80; break;
            case 2: x = (Math.random() - 0.5) * 80; z = -45; break;
            case 3: x = (Math.random() - 0.5) * 80; z = 45; break;
        }

        // Check if position is clear of obstacles
        validPosition = true;
        for (const obstacle of gameState.obstacles) {
            const obstacleRadius = (obstacle.size || 1.0) * 1.2;
            if (checkCollision(x, z, obstacle.x, obstacle.z, enemyRadius, obstacleRadius + minDistanceFromObstacles)) {
                validPosition = false;
                break;
            }
        }

        // Also check if not too close to other enemies
        if (validPosition) {
            for (const enemy of gameState.enemies) {
                if (checkCollision(x, z, enemy.x, enemy.z, enemyRadius, enemyRadius + 3)) {
                    validPosition = false;
                    break;
                }
            }
        }

        attempts++;
    }

    // If we found a valid position, spawn there. Otherwise spawn anyway (fallback)
    gameState.enemies.push({ x, z, angle: 0, turretAngle: 0, shootTimer: 3 + Math.random() * 2 });
}

// Render scene
function render(currentTime) {
    currentTime *= 0.001; // Convert to seconds

    // Initialize lastTime on first frame
    if (lastTime === 0) {
        lastTime = currentTime;
        requestAnimationFrame(render);
        return;
    }

    const deltaTime = Math.min(currentTime - lastTime, 0.1); // Cap at 0.1s to prevent large jumps
    lastTime = currentTime;

    // Update game state only if game started and not game over
    if (gameState.gameStarted && !gameState.gameOver) {
        updatePlayer(deltaTime);
        updateEnemies(deltaTime);
        updateShots(deltaTime);
    }

    const canvas = gl.canvas;

    // Set background color based on mode
    if (alternateMode) {
        gl.clearColor(0.05, 0.0, 0.1, 1.0); // Dark purple
    } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Black
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // === MAIN VIEW (Perspective) ===
    gl.viewport(0, 0, canvas.width, canvas.height);

    const aspect = canvas.width / canvas.height;
    const projectionMatrix = mat4.perspective(Math.PI / 3, aspect, 0.1, 100.0);

    let viewMatrix;
    if (alternateMode) {
        // Third-person camera: behind and above player
        // Mouse controls camera rotation (yaw left/right, pitch up/down)
        const cameraDistance = 8;
        const baseCameraHeight = 5;
        const tankOffsetBack = 3; // Move tank back towards camera
        
        // Apply arrow key input to camera angles
        if (keys['ArrowLeft']) {
            cameraYaw += cameraRotateSpeed * deltaTime;
        }
        if (keys['ArrowRight']) {
            cameraYaw -= cameraRotateSpeed * deltaTime;
        }
        if (keys['ArrowUp']) {
            cameraPitch += cameraRotateSpeed * deltaTime;
            // Clamp pitch to prevent camera from flipping
            cameraPitch = Math.min(maxPitch, cameraPitch);
        }
        if (keys['ArrowDown']) {
            cameraPitch -= cameraRotateSpeed * deltaTime;
            // Clamp pitch to prevent camera from flipping
            cameraPitch = Math.max(-maxPitch, cameraPitch);
        }
        
        // Calculate camera position based on yaw and pitch
        const horizontalDistance = cameraDistance * Math.cos(cameraPitch);
        const verticalOffset = cameraDistance * Math.sin(cameraPitch);
        const eyeX = gameState.player.x - Math.sin(cameraYaw) * horizontalDistance;
        const eyeZ = gameState.player.z - Math.cos(cameraYaw) * horizontalDistance;
        const eyeY = baseCameraHeight + verticalOffset;
        
        // Calculate look-at point (tank position offset back towards camera)
        const cameraLookAtX = gameState.player.x + Math.sin(cameraYaw) * tankOffsetBack;
        const cameraLookAtZ = gameState.player.z + Math.cos(cameraYaw) * tankOffsetBack;
        
        // Set turret to always face the direction the camera is facing
        // Camera forward direction is the same as cameraYaw (horizontal rotation)
        // Negate to fix rotation direction (clockwise vs counter-clockwise)
        gameState.player.turretAngle = -cameraYaw;
        
        // Look at point behind tank (towards camera)
        viewMatrix = mat4.lookAt(
            eyeX, eyeY, eyeZ,
            cameraLookAtX, 1, cameraLookAtZ,
            0, 1, 0
        );

        // Keep crosshair fixed at center (Minecraft-style)
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            crosshair.style.left = '50%';
            crosshair.style.top = '50%';
            crosshair.style.transform = 'translate(-50%, -50%)';
        }
    } else {
        // Normal mode: first-person camera
        // Reset crosshair to center in normal mode
        const crosshair = document.getElementById('crosshair');
        if (crosshair) {
            crosshair.style.left = '50%';
            crosshair.style.top = '50%';
            crosshair.style.transform = 'translate(-50%, -50%)';
        }
        
        const eyeX = gameState.player.x - Math.sin(gameState.player.angle) * 2;
        const eyeZ = gameState.player.z - Math.cos(gameState.player.angle) * 2;
        const centerX = gameState.player.x + Math.sin(gameState.player.angle) * 10;
        const centerZ = gameState.player.z + Math.cos(gameState.player.angle) * 10;
        viewMatrix = mat4.lookAt(
            eyeX, 1.5, eyeZ,
            centerX, 1, centerZ,
            0, 1, 0
        );
    }

    // Draw ground
    drawObject(groundBuffer, mat4.identity(), viewMatrix, projectionMatrix);

    if (alternateMode) {
        // Draw grid overlay on floor (raised very slightly to avoid z-fighting with ground)
        gl.lineWidth(2.0);
        const gridMatrix = mat4.translate(0, 0.001, 0); // Raise grid just barely above ground (0.001 units)
        drawObject(radarGridBuffer, gridMatrix, viewMatrix, projectionMatrix, gl.LINES);
        gl.lineWidth(1.0);
    }

    // Draw obstacles
    gameState.obstacles.forEach(obstacle => {
        const size = obstacle.size || 1.0;
        const height = obstacle.height || 1.0;
        const modelMatrix = mat4.multiply(
            mat4.translate(obstacle.x, height / 2, obstacle.z),
            mat4.scale(size, height, size)
        );
        drawObject(obstacleBuffer, modelMatrix, viewMatrix, projectionMatrix);
    });

    // Draw health pickups (only in alternate mode)
    if (alternateMode) {
        gameState.healthPickups.forEach(pickup => {
            const modelMatrix = mat4.multiply(
                mat4.translate(pickup.x, 1.5, pickup.z), // Elevated above ground
                mat4.multiply(
                    mat4.rotateY(pickup.rotation + currentTime * 2), // Rotating animation
                    mat4.scale(1.2, 1.2, 1.2)
                )
            );
            drawObject(heartBuffer, modelMatrix, viewMatrix, projectionMatrix);
        });
    }

    if (alternateMode) {
        // Draw player tank (base + turret)
        if (!gameState.player.dead) {
            // Base (rotates with movement direction)
            const baseMatrix = mat4.multiply(
                mat4.translate(gameState.player.x, 0, gameState.player.z),
                mat4.multiply(
                    mat4.rotateY(gameState.player.angle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(tankBaseBuffer, baseMatrix, viewMatrix, projectionMatrix);
            
            // Turret (rotates independently to face cursor)
            const turretMatrix = mat4.multiply(
                mat4.translate(gameState.player.x, 0, gameState.player.z),
                mat4.multiply(
                    mat4.rotateY(gameState.player.turretAngle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(tankTurretBuffer, turretMatrix, viewMatrix, projectionMatrix);

            // Cannon (same rotation as turret)
            const cannonMatrix = mat4.multiply(
                mat4.translate(gameState.player.x, 0, gameState.player.z),
                mat4.multiply(
                    mat4.rotateY(gameState.player.turretAngle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(tankCannonBuffer, cannonMatrix, viewMatrix, projectionMatrix);

            // Yellow arrow pointing forward (base facing direction)
            const arrowMatrix = mat4.multiply(
                mat4.translate(gameState.player.x, 0, gameState.player.z),
                mat4.multiply(
                    mat4.rotateY(gameState.player.angle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(tankArrowBuffer, arrowMatrix, viewMatrix, projectionMatrix);
            
            // Red arrow pointing in actual movement direction
            // Calculate movement direction from the actual movement vector
            if (Math.abs(gameState.player.velocity) > 0.1) {
                // The movement calculation is:
                // newX = x + sin(angle) * moveDistance
                // newZ = z + cos(angle) * moveDistance
                // So the movement direction vector is (sin(angle), cos(angle))
                // When velocity is negative, we move in opposite direction
                const moveDirX = Math.sin(gameState.player.angle) * Math.sign(gameState.player.velocity);
                const moveDirZ = Math.cos(gameState.player.angle) * Math.sign(gameState.player.velocity);
                // Calculate angle from movement vector
                const movementAngle = Math.atan2(moveDirX, moveDirZ);
                
                const movementArrowMatrix = mat4.multiply(
                    mat4.translate(gameState.player.x, 0, gameState.player.z),
                    mat4.multiply(
                        mat4.rotateY(movementAngle),
                        mat4.scale(1.5, 1, 1.5)
                    )
                );
                drawObject(movementArrowBuffer, movementArrowMatrix, viewMatrix, projectionMatrix);
            }
        }

        // Draw enemy tanks (base + turret) in tron red
        gameState.enemies.forEach(enemy => {
            // Base (rotates with movement direction)
            const baseMatrix = mat4.multiply(
                mat4.translate(enemy.x, 0, enemy.z),
                mat4.multiply(
                    mat4.rotateY(-enemy.angle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(enemyTankBaseBuffer, baseMatrix, viewMatrix, projectionMatrix);

            // Turret (rotates to face player)
            const turretMatrix = mat4.multiply(
                mat4.translate(enemy.x, 0, enemy.z),
                mat4.multiply(
                    mat4.rotateY(-enemy.turretAngle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(enemyTankTurretBuffer, turretMatrix, viewMatrix, projectionMatrix);

            // Cannon (same rotation as turret)
            const cannonMatrix = mat4.multiply(
                mat4.translate(enemy.x, 0, enemy.z),
                mat4.multiply(
                    mat4.rotateY(-enemy.turretAngle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(enemyTankCannonBuffer, cannonMatrix, viewMatrix, projectionMatrix);
        });
    } else {
        // Normal mode: draw enemy tanks as pyramids
        gameState.enemies.forEach(enemy => {
            const modelMatrix = mat4.multiply(
                mat4.translate(enemy.x, 0.5, enemy.z),
                mat4.multiply(
                    mat4.rotateY(enemy.angle),
                    mat4.scale(1.5, 1, 1.5)
                )
            );
            drawObject(enemyBuffer, modelMatrix, viewMatrix, projectionMatrix);
        });
    }

    // Draw player shot
    if (gameState.playerShot) {
        const modelMatrix = mat4.multiply(
            mat4.translate(gameState.playerShot.x, 0.5, gameState.playerShot.z),
            mat4.scale(0.5, 0.5, 0.5)
        );
        const buffer = alternateMode ? shotBuffer : obstacleBuffer;
        drawObject(buffer, modelMatrix, viewMatrix, projectionMatrix);
    }

    // Draw enemy shots
    gameState.enemyShots.forEach(shot => {
        const modelMatrix = mat4.multiply(
            mat4.translate(shot.x, 0.5, shot.z),
            mat4.scale(0.5, 0.5, 0.5)
        );
        const buffer = alternateMode ? shotBuffer : obstacleBuffer;
        drawObject(buffer, modelMatrix, viewMatrix, projectionMatrix);
    });

    // === RADAR VIEW (Orthographic top-down) ===
    const radarSize = 150;
    gl.viewport(canvas.width - radarSize - 10, canvas.height - radarSize - 10, radarSize, radarSize);

    // Radar view centered on player - player is always at center, map moves around them
    const radarProjection = mat4.ortho(-30, 30, -30, 30, -1, 100);
    // Camera looks down at player position (player is at center of radar)
    const radarView = mat4.lookAt(
        gameState.player.x, 50, gameState.player.z,  // Camera above player
        gameState.player.x, 0, gameState.player.z,   // Looking at player
        0, 0, -1  // Up vector
    );

    // Draw ground (smaller for radar)
    drawObject(groundBuffer, mat4.identity(), radarView, radarProjection);

    if (alternateMode) {
        // Draw grid for alternate mode radar (as lines, raised to avoid z-fighting)
        gl.lineWidth(2.0); // Make lines thicker for better visibility
        const radarGridMatrix = mat4.translate(0, 0.01, 0); // Raise grid slightly above ground
        drawObject(radarGridBuffer, radarGridMatrix, radarView, radarProjection, gl.LINES);
        gl.lineWidth(1.0); // Reset to default
    }

    // Draw obstacles on radar (scaled based on actual size)
    gameState.obstacles.forEach(obstacle => {
        const size = obstacle.size || 1.0;
        const radarScale = size * 2; // Scale for radar visibility
        const modelMatrix = mat4.multiply(
            mat4.translate(obstacle.x, 0.5, obstacle.z),
            mat4.scale(radarScale, radarScale, radarScale)
        );
        drawObject(obstacleBuffer, modelMatrix, radarView, radarProjection);
    });

    // Draw health pickups on radar (only in alternate mode)
    if (alternateMode) {
        gameState.healthPickups.forEach(pickup => {
            const modelMatrix = mat4.multiply(
                mat4.translate(pickup.x, 0.5, pickup.z),
                mat4.scale(2, 2, 2) // Larger for visibility on radar
            );
            drawObject(heartBuffer, modelMatrix, radarView, radarProjection);
        });
    }

    // Draw enemy on radar (larger icons)
    gameState.enemies.forEach(enemy => {
        const modelMatrix = mat4.multiply(
            mat4.translate(enemy.x, 0.5, enemy.z),
            mat4.multiply(
                mat4.rotateY(enemy.angle),
                mat4.scale(3, 2, 3) // Increased from 1.5 to 3
            )
        );
        drawObject(enemyRadarBuffer, modelMatrix, radarView, radarProjection);
    });

    // Draw player on radar (only if not dead) (larger icons)
    if (!gameState.player.dead) {
        if (alternateMode) {
            // Alternate mode: draw player as triangle pointing in camera facing direction
            // Use cameraYaw (negated to match camera rotation direction)
            const playerTriangleModel = mat4.multiply(
                mat4.translate(gameState.player.x, 0.1, gameState.player.z),
                mat4.multiply(
                    mat4.rotateY(-cameraYaw),
                    mat4.scale(4, 2, 4) // Increased from 2 to 4
                )
            );
            drawObject(radarPlayerArrowBuffer, playerTriangleModel, radarView, radarProjection);
        } else {
            // Normal mode: draw player as pyramid
            const playerModel = mat4.multiply(
                mat4.translate(gameState.player.x, 0.5, gameState.player.z),
                mat4.multiply(
                    mat4.rotateY(gameState.player.angle),
                    mat4.scale(3, 2, 3) // Increased from 1.5 to 3
                )
            );
            drawObject(playerRadarBuffer, playerModel, radarView, radarProjection);
        }
    }

    // Update UI displays
    if (!gameState.gameStarted && alternateMode) {
        // Show start screen (only in alternate mode)
        if (startScreenElement) startScreenElement.style.display = 'block';
        if (gameOverElement) gameOverElement.style.display = 'none';
        if (countdownElement) countdownElement.style.display = 'none';
        if (invulnerableElement) invulnerableElement.style.display = 'none';
    } else if (gameState.gameOver && alternateMode) {
        // Show game over screen (only in alternate mode)
        if (startScreenElement) startScreenElement.style.display = 'none';
        if (gameOverElement) gameOverElement.style.display = 'block';
        if (countdownElement) countdownElement.style.display = 'none';
        if (invulnerableElement) invulnerableElement.style.display = 'none';
    } else {
        // Game is running
        if (startScreenElement) startScreenElement.style.display = 'none';
        if (gameOverElement) gameOverElement.style.display = 'none';
        // Update countdown display
        if (gameState.player.dead && gameState.player.deadTime > 0) {
            countdownElement.style.display = 'block';
            countdownElement.textContent = Math.ceil(gameState.player.deadTime);
            invulnerableElement.style.display = 'none';
        } else if (gameState.player.invulnerable && gameState.player.invulnerableTime > 0) {
            countdownElement.style.display = 'none';
            invulnerableElement.style.display = 'block';
            invulnerableElement.textContent = 'INVULNERABLE\n' + Math.ceil(gameState.player.invulnerableTime);
        } else {
            countdownElement.style.display = 'none';
            invulnerableElement.style.display = 'none';
        }
    }

    // Update score display (only in alternate mode)
    if (scoreElement) {
        if (alternateMode) {
            scoreElement.style.display = 'block';
            scoreElement.textContent = `Score: ${gameState.score} | High: ${highScore} | Wave: ${gameState.wave} | Lives: ${gameState.lives}`;
        } else {
            scoreElement.style.display = 'none';
        }
    }

    // Update health bar (only in alternate mode)
    if (healthFillElement && healthTextElement) {
        if (alternateMode && gameState.gameStarted) {
            const healthBar = document.getElementById('healthBar');
            if (healthBar) healthBar.style.display = 'block';
            const healthPercent = (gameState.player.health / gameState.player.maxHealth) * 100;
            healthFillElement.style.width = healthPercent + '%';
            healthTextElement.textContent = `${Math.ceil(gameState.player.health)} / ${gameState.player.maxHealth}`;
        } else {
            const healthBar = document.getElementById('healthBar');
            if (healthBar) healthBar.style.display = 'none';
        }
    }

    requestAnimationFrame(render);
}

// Generate random obstacles
function generateObstacles() {
    const numObstacles = 15; // Number of obstacles to generate (reduced from 30)
    const mapSize = 90; // Keep obstacles within -45 to 45 range
    const minDistance = 8; // Minimum distance from player spawn (0,0) and from each other

    gameState.obstacles = [];

    for (let i = 0; i < numObstacles; i++) {
        let x, z;
        let validPosition = false;
        let attempts = 0;
        const maxAttempts = 100;

        while (!validPosition && attempts < maxAttempts) {
            // Random position within map bounds
            x = (Math.random() - 0.5) * mapSize;
            z = (Math.random() - 0.5) * mapSize;

            // Check distance from player spawn
            const distFromPlayer = Math.sqrt(x * x + z * z);
            if (distFromPlayer < minDistance) {
                attempts++;
                continue;
            }

            // Check distance from other obstacles
            validPosition = true;
            for (const obstacle of gameState.obstacles) {
                const dx = x - obstacle.x;
                const dz = z - obstacle.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < minDistance) {
                    validPosition = false;
                    break;
                }
            }

            attempts++;
        }

        if (validPosition) {
            // Random size between 0.5 and 2.5
            const size = 0.5 + Math.random() * 2.0;
            // Random height between 0.5 and 3.0
            const height = 0.5 + Math.random() * 2.5;
            // Random type
            const type = Math.random() < 0.5 ? 'cube' : 'pyramid';

            gameState.obstacles.push({ x, z, type, size, height });
        }
    }
}

function spawnHealthPickup() {
    const mapSize = 90;
    const minDistance = 5; // Minimum distance from obstacles and player
    let x, z;
    let validPosition = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!validPosition && attempts < maxAttempts) {
        // Random position within map bounds
        x = (Math.random() - 0.5) * mapSize;
        z = (Math.random() - 0.5) * mapSize;

        // Check distance from player
        const distFromPlayer = Math.sqrt(
            (x - gameState.player.x) * (x - gameState.player.x) +
            (z - gameState.player.z) * (z - gameState.player.z)
        );
        if (distFromPlayer < minDistance) {
            attempts++;
            continue;
        }

        // Check distance from obstacles
        validPosition = true;
        for (const obstacle of gameState.obstacles) {
            const dx = x - obstacle.x;
            const dz = z - obstacle.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDistance) {
                validPosition = false;
                break;
            }
        }

        // Check distance from other health pickups
        if (validPosition) {
            for (const pickup of gameState.healthPickups) {
                const dx = x - pickup.x;
                const dz = z - pickup.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < minDistance) {
                    validPosition = false;
                    break;
                }
            }
        }

        attempts++;
    }

    if (validPosition) {
        gameState.healthPickups.push({
            x,
            z,
            rotation: Math.random() * Math.PI * 2 // Random initial rotation for visual variety
        });
    }
}

// Start the game
function startGame() {
    gameState.gameStarted = true;
    if (startScreenElement) {
        startScreenElement.style.display = 'none';
    }
}

// Check if we should show start screen (only in alternate mode)
function shouldShowStartScreen() {
    return alternateMode && !gameState.gameStarted;
}

// Load high score from localStorage
function loadHighScore() {
    const stored = localStorage.getItem('battlezoneHighScore');
    if (stored) {
        highScore = parseInt(stored, 10) || 0;
    }
}

// Save high score to localStorage (only if new score is higher)
function updateHighScore(newScore) {
    if (newScore > highScore) {
        highScore = newScore;
        localStorage.setItem('battlezoneHighScore', highScore.toString());
    }
}

// Reset the game to initial state
function resetGame() {
    // Reset player
    gameState.player.x = 0;
    gameState.player.z = 0;
    gameState.player.angle = 0;
    gameState.player.turretAngle = 0;
    gameState.player.velocity = 0;
    gameState.player.dead = false;
    gameState.player.deadTime = 0;
    gameState.player.invulnerable = false;
    gameState.player.invulnerableTime = 0;
    gameState.player.health = 150;
    gameState.player.maxHealth = 150;

    // Reset game state
    gameState.playerShot = null;
    gameState.enemyShots = [];
    gameState.enemies = [
        { x: 20, z: 20, angle: 0, turretAngle: 0, shootTimer: 3 }
    ];
    gameState.score = 0;
    gameState.wave = 1;
    gameState.enemiesKilledThisWave = 0;
    gameState.enemiesPerWave = 1;
    gameState.lives = 3;
    gameState.gameOver = false;
    gameState.gameStarted = false;

    // Regenerate obstacles and health pickups
    generateObstacles();
    gameState.healthPickups = [];
    for (let i = 0; i < 5; i++) {
        spawnHealthPickup();
    }

    // Reset camera angles
    cameraYaw = 0;
    cameraPitch = 0;

    // Show start screen
    if (startScreenElement) {
        startScreenElement.style.display = 'block';
    }
    if (gameOverElement) {
        gameOverElement.style.display = 'none';
    }
}

// Main initialization
function init() {
    if (!initWebGL()) return;
    if (!initShaders()) return;
    generateObstacles(); // Generate obstacles before geometry

    // Spawn initial health pickups
    for (let i = 0; i < 5; i++) {
        spawnHealthPickup();
    }

    initGeometry();

    // Load high score from localStorage
    loadHighScore();

    // Get UI elements
    countdownElement = document.getElementById('countdown');
    invulnerableElement = document.getElementById('invulnerable');
    scoreElement = document.getElementById('score');
    healthFillElement = document.getElementById('healthFill');
    healthTextElement = document.getElementById('healthText');
    gameOverElement = document.getElementById('gameOver');
    startScreenElement = document.getElementById('startScreen');
    startButtonElement = document.getElementById('startButton');
    restartButtonElement = document.getElementById('restartButton');

    // Add event listeners for buttons
    if (startButtonElement) {
        startButtonElement.addEventListener('click', startGame);
    }
    if (restartButtonElement) {
        restartButtonElement.addEventListener('click', resetGame);
    }

    // In normal mode, start game automatically (no start screen)
    // In alternate mode, show start screen
    if (!alternateMode) {
        gameState.gameStarted = true;
    }

    // Update cursor based on mode
    const canvas = document.getElementById('glcanvas');
    if (alternateMode && canvas) {
        canvas.style.cursor = 'none';
    }

    requestAnimationFrame(render);
}

// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // ESC key to instantly end game (only in alternate mode during gameplay)
    if (e.key === 'Escape' && alternateMode && gameState.gameStarted && !gameState.gameOver) {
        // Trigger game over
        gameState.gameOver = true;
        gameState.lives = 0;
        updateHighScore(gameState.score);
    }

    // Toggle alternate mode with '!'
    if (e.key === '!') {
        alternateMode = !alternateMode;
        // Recreate geometry with new colors
        initGeometry();
        // Update crosshair color and cursor visibility
        const crosshair = document.getElementById('crosshair');
        const canvas = document.getElementById('glcanvas');
        if (alternateMode) {
            crosshair.style.setProperty('--crosshair-color', '#f0f');
            // Keep crosshair at center
            crosshair.style.left = '50%';
            crosshair.style.top = '50%';
            // Hide cursor in alternate mode
            if (canvas) {
                canvas.style.cursor = 'none';
            }
            // Reset camera angles
            cameraYaw = gameState.player.angle; // Initialize to player angle
            cameraPitch = 0;
            // Show start screen in alternate mode (reset game state)
            resetGame();
        } else {
            crosshair.style.setProperty('--crosshair-color', '#0f0');
            // Reset crosshair to center in normal mode
            crosshair.style.left = '50%';
            crosshair.style.top = '50%';
            // Show cursor in normal mode
            if (canvas) {
                canvas.style.cursor = 'default';
            }
            // Start game immediately in normal mode
            gameState.gameStarted = true;
            // Hide start screen and game over
            if (startScreenElement) startScreenElement.style.display = 'none';
            if (gameOverElement) gameOverElement.style.display = 'none';
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});


// Start the game
window.onload = init;
