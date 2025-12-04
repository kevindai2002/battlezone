// WebGL Context and Program
let gl;
let shaderProgram;

// Game state
const gameState = {
    player: {
        x: 0,
        z: 0,
        angle: 0,
        dead: false,
        deadTime: 0,
        invulnerable: false,
        invulnerableTime: 0
    },
    playerShot: null,
    enemyShots: [],
    enemies: [
        { x: 20, z: 20, angle: 0, shootTimer: 3 }
    ],
    obstacles: [
        { x: -15, z: 10, type: 'cube' },
        { x: 10, z: -15, type: 'pyramid' },
        { x: -10, z: -10, type: 'cube' },
        { x: 15, z: 15, type: 'pyramid' }
    ]
};

// Geometry buffers
let obstacleBuffer, enemyBuffer, groundBuffer, playerBuffer, playerRadarBuffer, enemyRadarBuffer;

// Input state
const keys = {};

// Time tracking
let lastTime = 0;

// Alternate mode flag
let alternateMode = false;

// UI elements
let countdownElement;
let invulnerableElement;

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
    if (alternateMode) {
        // Alternate mode: neon colors
        obstacleBuffer = createBuffers(createCube([1, 0, 1]));      // Magenta obstacles
        enemyBuffer = createBuffers(createPyramid([0, 1, 1])); // Cyan enemies
        playerBuffer = createBuffers(createCube([1, 1, 0])); // Yellow player (not used in main view)
        playerRadarBuffer = createBuffers(createPyramid([1, 1, 0])); // Yellow player radar icon
        enemyRadarBuffer = createBuffers(createPyramid([0, 1, 1])); // Cyan enemy radar icon
        groundBuffer = createBuffers(createGround(50, [0.1, 0.0, 0.2])); // Dark purple
    } else {
        // Normal mode: original colors
        obstacleBuffer = createBuffers(createCube([0.5, 0.5, 0.5]));      // Gray obstacles
        enemyBuffer = createBuffers(createPyramid([1, 0, 0])); // Red enemies
        playerBuffer = createBuffers(createCube([0.6, 0.85, 1.0])); // Carolina blue player (not used in main view)
        playerRadarBuffer = createBuffers(createPyramid([0.6, 0.85, 1.0])); // Carolina blue player radar icon
        enemyRadarBuffer = createBuffers(createPyramid([1, 0, 0])); // Red enemy radar icon
        groundBuffer = createBuffers(createGround(50, [0.2, 0.2, 0.2])); // Gray
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
        // Check for obstacles ahead
        const lookAheadDist = 5;
        const lookAheadX = enemy.x + Math.sin(enemy.angle) * lookAheadDist;
        const lookAheadZ = enemy.z + Math.cos(enemy.angle) * lookAheadDist;

        let obstacleAhead = false;
        let avoidLeft = false;

        // Check if obstacle is in front
        for (const obstacle of gameState.obstacles) {
            if (checkCollision(lookAheadX, lookAheadZ, obstacle.x, obstacle.z, 1.5, 3)) {
                obstacleAhead = true;
                // Determine which way to turn to avoid
                const obstacleAngle = Math.atan2(obstacle.x - enemy.x, obstacle.z - enemy.z);
                let angleDiffToObstacle = obstacleAngle - enemy.angle;
                while (angleDiffToObstacle > Math.PI) angleDiffToObstacle -= 2 * Math.PI;
                while (angleDiffToObstacle < -Math.PI) angleDiffToObstacle += 2 * Math.PI;
                avoidLeft = angleDiffToObstacle > 0;
                break;
            }
        }

        // Decide on movement
        if (obstacleAhead) {
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

        // Always move forward in the direction facing
        const moveX = Math.sin(enemy.angle) * enemySpeed;
        const moveZ = Math.cos(enemy.angle) * enemySpeed;

        // Calculate new position
        const newX = enemy.x + moveX;
        const newZ = enemy.z + moveZ;

        // Check collisions
        let collided = false;

        // Check obstacles
        for (const obstacle of gameState.obstacles) {
            if (checkCollision(newX, newZ, obstacle.x, obstacle.z, 1.5, 2)) {
                collided = true;
                break;
            }
        }

        // Check other enemies
        if (!collided) {
            for (const other of gameState.enemies) {
                if (other !== enemy && checkCollision(newX, newZ, other.x, other.z, 1.5, 1.5)) {
                    collided = true;
                    break;
                }
            }
        }

        // Check player
        if (!collided && checkCollision(newX, newZ, gameState.player.x, gameState.player.z, 1.5, 1.5)) {
            collided = true;
        }

        // Update position if no collision
        if (!collided) {
            enemy.x = newX;
            enemy.z = newZ;
        }

        // Handle shooting - only shoot at player if they're alive
        if (!gameState.player.dead) {
            enemy.shootTimer -= deltaTime;
            if (enemy.shootTimer <= 0) {
                // Calculate angle to player for shooting
                const dx = gameState.player.x - enemy.x;
                const dz = gameState.player.z - enemy.z;
                const angleToPlayer = Math.atan2(dx, dz);
                gameState.enemyShots.push({
                    x: enemy.x,
                    z: enemy.z,
                    vx: Math.sin(angleToPlayer) * 25,
                    vz: Math.cos(angleToPlayer) * 25
                });
                enemy.angle = angleToPlayer;
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
        }
        return; // Player cannot move while dead
    }

    const moveSpeed = 10 * deltaTime;
    const turnSpeed = 2 * deltaTime;
    const playerRadius = 1.5;

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
    for (const obstacle of gameState.obstacles) {
        if (checkCollision(newX, newZ, obstacle.x, obstacle.z, playerRadius, 2)) {
            collided = true;
            break;
        }
    }

    // Check collisions with enemies
    if (!collided) {
        for (const enemy of gameState.enemies) {
            if (checkCollision(newX, newZ, enemy.x, enemy.z, playerRadius, 1.5)) {
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

    // Handle invulnerability
    if (gameState.player.invulnerable) {
        gameState.player.invulnerableTime -= deltaTime;
        if (gameState.player.invulnerableTime <= 0) {
            gameState.player.invulnerable = false;
        }
    }

    // Handle shooting
    if (keys[' '] && !gameState.playerShot) {
        gameState.playerShot = {
            x: gameState.player.x + Math.sin(gameState.player.angle) * 2,
            z: gameState.player.z + Math.cos(gameState.player.angle) * 2,
            vx: Math.sin(gameState.player.angle) * 30,
            vz: Math.cos(gameState.player.angle) * 30
        };
    }
}

// Update shots
function updateShots(deltaTime) {
    const shotRadius = 0.5;
    const fieldSize = 50;

    // Update player shot
    if (gameState.playerShot) {
        gameState.playerShot.x += gameState.playerShot.vx * deltaTime;
        gameState.playerShot.z += gameState.playerShot.vz * deltaTime;

        // Check if out of bounds
        if (Math.abs(gameState.playerShot.x) > fieldSize || Math.abs(gameState.playerShot.z) > fieldSize) {
            gameState.playerShot = null;
        } else {
            // Check collision with obstacles
            for (const obstacle of gameState.obstacles) {
                if (checkCollision(gameState.playerShot.x, gameState.playerShot.z, obstacle.x, obstacle.z, shotRadius, 2)) {
                    gameState.playerShot = null;
                    break;
                }
            }

            // Check collision with enemies
            if (gameState.playerShot) {
                for (let i = gameState.enemies.length - 1; i >= 0; i--) {
                    const enemy = gameState.enemies[i];
                    if (checkCollision(gameState.playerShot.x, gameState.playerShot.z, enemy.x, enemy.z, shotRadius, 1.5)) {
                        gameState.playerShot = null;
                        gameState.enemies.splice(i, 1);
                        // Spawn new enemy at random edge
                        spawnEnemy();
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
            if (checkCollision(shot.x, shot.z, obstacle.x, obstacle.z, shotRadius, 2)) {
                gameState.enemyShots.splice(i, 1);
                hitObstacle = true;
                break;
            }
        }

        if (hitObstacle) continue;

        // Check collision with player
        if (!gameState.player.invulnerable && !gameState.player.dead &&
            checkCollision(shot.x, shot.z, gameState.player.x, gameState.player.z, shotRadius, 1.5)) {
            gameState.enemyShots.splice(i, 1);
            // Player dies - enter dead state for 3 seconds, then invulnerable for 5 seconds
            gameState.player.dead = true;
            gameState.player.deadTime = 3;
        }
    }
}

// Spawn enemy at random edge
function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, z;

    switch(edge) {
        case 0: x = -45; z = (Math.random() - 0.5) * 80; break;
        case 1: x = 45; z = (Math.random() - 0.5) * 80; break;
        case 2: x = (Math.random() - 0.5) * 80; z = -45; break;
        case 3: x = (Math.random() - 0.5) * 80; z = 45; break;
    }

    gameState.enemies.push({ x, z, angle: 0, shootTimer: 3 + Math.random() * 2 });
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

    // Update game state
    updatePlayer(deltaTime);
    updateEnemies(deltaTime);
    updateShots(deltaTime);

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
        drawObject(obstacleBuffer, modelMatrix, viewMatrix, projectionMatrix);
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
        drawObject(enemyBuffer, modelMatrix, viewMatrix, projectionMatrix);
    });

    // Draw player shot
    if (gameState.playerShot) {
        const modelMatrix = mat4.multiply(
            mat4.translate(gameState.playerShot.x, 0.5, gameState.playerShot.z),
            mat4.scale(0.5, 0.5, 0.5)
        );
        drawObject(obstacleBuffer, modelMatrix, viewMatrix, projectionMatrix);
    }

    // Draw enemy shots
    gameState.enemyShots.forEach(shot => {
        const modelMatrix = mat4.multiply(
            mat4.translate(shot.x, 0.5, shot.z),
            mat4.scale(0.5, 0.5, 0.5)
        );
        drawObject(obstacleBuffer, modelMatrix, viewMatrix, projectionMatrix);
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
        drawObject(obstacleBuffer, modelMatrix, radarView, radarProjection);
    });

    // Draw enemy on radar
    gameState.enemies.forEach(enemy => {
        const modelMatrix = mat4.multiply(
            mat4.translate(enemy.x, 0.5, enemy.z),
            mat4.multiply(
                mat4.rotateY(enemy.angle),
                mat4.scale(1.5, 1, 1.5)
            )
        );
        drawObject(enemyRadarBuffer, modelMatrix, radarView, radarProjection);
    });

    // Draw player on radar (only if not dead)
    if (!gameState.player.dead) {
        const playerModel = mat4.multiply(
            mat4.translate(gameState.player.x, 0.5, gameState.player.z),
            mat4.multiply(
                mat4.rotateY(gameState.player.angle),
                mat4.scale(1.5, 1, 1.5)
            )
        );
        drawObject(playerRadarBuffer, playerModel, radarView, radarProjection);
    }

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

    requestAnimationFrame(render);
}

// Main initialization
function init() {
    if (!initWebGL()) return;
    if (!initShaders()) return;
    initGeometry();

    // Get UI elements
    countdownElement = document.getElementById('countdown');
    invulnerableElement = document.getElementById('invulnerable');

    requestAnimationFrame(render);
}

// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Toggle alternate mode with '!'
    if (e.key === '!') {
        alternateMode = !alternateMode;
        // Recreate geometry with new colors
        initGeometry();
        // Update crosshair color
        const crosshair = document.getElementById('crosshair');
        if (alternateMode) {
            crosshair.style.setProperty('--crosshair-color', '#f0f');
        } else {
            crosshair.style.setProperty('--crosshair-color', '#0f0');
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Start the game
window.onload = init;
