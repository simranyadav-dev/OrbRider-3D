// Game Variables
        let scene, camera, renderer, ghost = [], food, obstacles = [];
        let gameRunning = false, gamePaused = false;
        let direction = { x: 1, y: 0 };
        let score = 0, level = 1, gameSpeed = 300, lastTime = 0;
        let currentDifficulty = 'easy', currentMode = 'classic';
        let timeLeft = 60, gameTimer = null;

        // Game Settings
        const difficulties = {
            easy: { speed: 300, speedIncrease: 0.98 },
            medium: { speed: 200, speedIncrease: 0.95 },
            hard: { speed: 150, speedIncrease: 0.92 },
            extreme: { speed: 100, speedIncrease: 0.90 }
        };

        const modes = {
            classic: { hasWalls: true, hasTimer: false, hasObstacles: false },
            endless: { hasWalls: false, hasTimer: false, hasObstacles: false },
            timed: { hasWalls: true, hasTimer: true, hasObstacles: false },
            maze: { hasWalls: true, hasTimer: false, hasObstacles: true }
        };

        // Grid settings
        const GRID_SIZE = 20;
        const GRID_WIDTH = 30;
        const GRID_HEIGHT = 20;

        // Theme Management
        function toggleTheme() {
            const body = document.body;
            const themeIcon = document.getElementById('themeIcon');
            
            if (body.dataset.theme === 'light') {
                body.dataset.theme = 'dark';
                themeIcon.textContent = '🌙';
            } else {
                body.dataset.theme = 'light';
                themeIcon.textContent = '☀️';
            }
        }

        // Menu Management
        document.addEventListener('DOMContentLoaded', function() {
            // Difficulty selection
            document.querySelectorAll('[data-difficulty]').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('[data-difficulty]').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    currentDifficulty = this.dataset.difficulty;
                });
            });

            // Mode selection
            document.querySelectorAll('[data-mode]').forEach(btn => {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    currentMode = this.dataset.mode;
                });
            });
        });

        function startGame() {
            document.getElementById('menuScreen').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            // Show timer for timed mode
            if (currentMode === 'timed') {
                document.getElementById('timeDisplay').style.display = 'block';
                timeLeft = 60;
                startTimer();
            }

            initGame();
        }

        function backToMenu() {
            document.getElementById('menuScreen').style.display = 'block';
            document.getElementById('gameContainer').style.display = 'none';
            document.getElementById('gameOver').style.display = 'none';
            
            if (gameTimer) {
                clearInterval(gameTimer);
                gameTimer = null;
            }
            
            resetGame();
        }

        function initGame() {
            // Scene setup
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a1a2e);

            // Camera
            camera = new THREE.PerspectiveCamera(75, 600/400, 0.1, 1000);
            camera.position.set(0, 25, 25);
            camera.lookAt(0, 0, 0);

            // Renderer
            const canvas = document.getElementById('gameCanvas');
            renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
            renderer.setSize(600, 400);
            renderer.shadowMap.enabled = true;

            // Lighting
            const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 20, 5);
            directionalLight.castShadow = true;
            scene.add(directionalLight);

            // Create boundaries if needed
            if (modes[currentMode].hasWalls) {
                createBoundaries();
            }

            // Create obstacles for maze mode
            if (modes[currentMode].hasObstacles) {
                createMazeObstacles();
            }

            // Initialize ghost
            createGhost();
            createFood();

            // Reset game state
            gameRunning = true;
            gamePaused = false;
            score = 0;
            level = 1;
            gameSpeed = difficulties[currentDifficulty].speed;
            direction = { x: 1, y: 0 };

            updateUI();
            animate();
        }

        function createGhost() {
            ghost = [];
            
            // Ghost head (3D sphere with glow effect)
            const ghostGeometry = new THREE.SphereGeometry(0.8, 16, 16);
            const ghostMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x00ffff,
                transparent: true,
                opacity: 0.9,
                emissive: 0x002244
            });

            const ghostHead = new THREE.Mesh(ghostGeometry, ghostMaterial);
            ghostHead.position.set(0, 0, 0);
            ghostHead.castShadow = true;
            
            // Add glow effect
            const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff,
                transparent: true,
                opacity: 0.2 
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            ghostHead.add(glow);

            ghost.push(ghostHead);
            scene.add(ghostHead);
        }

        function createFood() {
            if (food) {
                scene.remove(food);
            }

            const foodGeometry = new THREE.OctahedronGeometry(0.6, 0);
            const foodMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xff6b6b,
                transparent: true,
                opacity: 0.9,
                emissive: 0x330000
            });

            food = new THREE.Mesh(foodGeometry, foodMaterial);
            
            // Random position
            let foodX, foodY;
            do {
                foodX = Math.floor(Math.random() * (GRID_WIDTH - 2)) - Math.floor(GRID_WIDTH/2) + 1;
                foodY = Math.floor(Math.random() * (GRID_HEIGHT - 2)) - Math.floor(GRID_HEIGHT/2) + 1;
            } while (ghost.some(segment => 
                Math.floor(segment.position.x) === foodX && 
                Math.floor(segment.position.z) === foodY
            ));

            food.position.set(foodX, 0, foodY);
            scene.add(food);
        }

        function createBoundaries() {
            const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
            const wallGeometry = new THREE.BoxGeometry(1, 2, 1);

            // Create walls
            for (let x = -GRID_WIDTH/2; x <= GRID_WIDTH/2; x++) {
                // Top and bottom walls
                const topWall = new THREE.Mesh(wallGeometry, wallMaterial);
                topWall.position.set(x, 0, -GRID_HEIGHT/2);
                scene.add(topWall);

                const bottomWall = new THREE.Mesh(wallGeometry, wallMaterial);
                bottomWall.position.set(x, 0, GRID_HEIGHT/2);
                scene.add(bottomWall);
            }

            for (let y = -GRID_HEIGHT/2; y <= GRID_HEIGHT/2; y++) {
                // Left and right walls
                const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
                leftWall.position.set(-GRID_WIDTH/2, 0, y);
                scene.add(leftWall);

                const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
                rightWall.position.set(GRID_WIDTH/2, 0, y);
                scene.add(rightWall);
            }
        }

        function createMazeObstacles() {
            const obstacleMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
            const obstacleGeometry = new THREE.BoxGeometry(1, 1, 1);

            // Create random obstacles
            for (let i = 0; i < level * 3; i++) {
                const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
                let x, z;
                do {
                    x = Math.floor(Math.random() * (GRID_WIDTH - 4)) - Math.floor(GRID_WIDTH/2) + 2;
                    z = Math.floor(Math.random() * (GRID_HEIGHT - 4)) - Math.floor(GRID_HEIGHT/2) + 2;
                } while (Math.abs(x) < 3 && Math.abs(z) < 3); // Don't place near starting position

                obstacle.position.set(x, 0, z);
                obstacles.push(obstacle);
                scene.add(obstacle);
            }
        }

        function moveGhost() {
            if (!gameRunning || gamePaused) return;

            const head = ghost[0];
            const newX = head.position.x + direction.x;
            const newZ = head.position.z + direction.y;

            // Check boundaries (walls or screen edges)
            if (modes[currentMode].hasWalls) {
                if (Math.abs(newX) >= GRID_WIDTH/2 || Math.abs(newZ) >= GRID_HEIGHT/2) {
                    gameOver();
                    return;
                }
            } else {
                // Endless mode - wrap around
                const wrappedX = ((newX + GRID_WIDTH/2) % GRID_WIDTH) - GRID_WIDTH/2;
                const wrappedZ = ((newZ + GRID_HEIGHT/2) % GRID_HEIGHT) - GRID_HEIGHT/2;
                head.position.set(wrappedX, 0, wrappedZ);
            }

            // Check self collision
            if (ghost.slice(1).some(segment => 
                Math.floor(segment.position.x) === Math.floor(newX) && 
                Math.floor(segment.position.z) === Math.floor(newZ)
            )) {
                gameOver();
                return;
            }

            // Check obstacle collision
            if (obstacles.some(obstacle => 
                Math.floor(obstacle.position.x) === Math.floor(newX) && 
                Math.floor(obstacle.position.z) === Math.floor(newZ)
            )) {
                gameOver();
                return;
            }

            // Move ghost segments
            for (let i = ghost.length - 1; i > 0; i--) {
                ghost[i].position.copy(ghost[i - 1].position);
            }

            if (modes[currentMode].hasWalls) {
                head.position.set(newX, 0, newZ);
            }

            // Check food collision
            if (Math.floor(head.position.x) === Math.floor(food.position.x) && 
                Math.floor(head.position.z) === Math.floor(food.position.z)) {
                eatFood();
            }

            // Animate food and ghost effects
            if (food) {
                food.rotation.y += 0.1;
            }

            ghost.forEach((segment, index) => {
                if (segment.children[0]) {
                    segment.children[0].rotation.y += 0.05;
                    const scale = 1 + 0.1 * Math.sin(Date.now() * 0.01 + index);
                    segment.children[0].scale.setScalar(scale);
                }
            });
        }

        function eatFood() {
            score += (level * 10);
            
            // Add new ghost segment
            const tail = ghost[ghost.length - 1];
            const newSegment = tail.clone();
            newSegment.material = tail.material.clone();
            newSegment.material.opacity = Math.max(0.3, 0.9 - (ghost.length * 0.05));
            
            ghost.push(newSegment);
            scene.add(newSegment);

            createFood();
            
            // Level up every 5 food items
            if (ghost.length % 5 === 0) {
                level++;
                gameSpeed *= difficulties[currentDifficulty].speedIncrease;
                
                if (currentMode === 'maze') {
                    obstacles.forEach(obs => scene.remove(obs));
                    obstacles = [];
                    createMazeObstacles();
                }
            }

            updateUI();
        }

        function updateUI() {
            document.getElementById('score').textContent = score;
            document.getElementById('length').textContent = ghost.length;
            document.getElementById('level').textContent = level;
        }

        function startTimer() {
            gameTimer = setInterval(() => {
                timeLeft--;
                document.getElementById('timeLeft').textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    gameOver();
                }
            }, 1000);
        }

        function togglePause() {
            gamePaused = !gamePaused;
            document.querySelector('.pause-btn').textContent = gamePaused ? 'RESUME' : 'PAUSE';
        }

        function gameOver() {
            gameRunning = false;
            if (gameTimer) {
                clearInterval(gameTimer);
                gameTimer = null;
            }
            
            document.getElementById('finalScore').textContent = score;
            document.getElementById('maxLength').textContent = ghost.length;
            document.getElementById('gameOver').style.display = 'block';
        }

        function restartGame() {
            document.getElementById('gameOver').style.display = 'none';
            resetGame();
            initGame();
        }

        function resetGame() {
            if (scene) {
                // Clear all game objects
                ghost.forEach(segment => scene.remove(segment));
                obstacles.forEach(obs => scene.remove(obs));
                if (food) scene.remove(food);
                
                ghost = [];
                obstacles = [];
                food = null;
            }
            
            score = 0;
            level = 1;
            timeLeft = 60;
        }

        function animate() {
            if (!gameRunning) return;
            
            requestAnimationFrame(animate);
            
            const currentTime = Date.now();
            if (currentTime - lastTime > gameSpeed) {
                moveGhost();
                lastTime = currentTime;
            }

            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        }

        // Controls
        document.addEventListener('keydown', (event) => {
            if (!gameRunning) return;
            
            event.preventDefault();
            
            switch(event.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    if (direction.y === 0) direction = { x: 0, y: -1 };
                    break;
                case 's':
                case 'arrowdown':
                    if (direction.y === 0) direction = { x: 0, y: 1 };
                    break;
                case 'a':
                case 'arrowleft':
                    if (direction.x === 0) direction = { x: -1, y: 0 };
                    break;
                case 'd':
                case 'arrowright':
                    if (direction.x === 0) direction = { x: 1, y: 0 };
                    break;
                case ' ':
                    togglePause();
                    break;
                case 'escape':
                    backToMenu();
                    break;
            }
        });

        // Initialize theme
        document.body.dataset.theme = 'dark';
    